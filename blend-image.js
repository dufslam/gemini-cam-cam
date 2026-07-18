module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = process.env.GEMINI_API_KEY;
    if (!token) {
      return res.status(500).json({ error: 'Google Gemini API key is not configured on the Vercel server.' });
    }

    const { selfie, cam, prompt } = req.body;
    if (!selfie || !cam) {
      return res.status(400).json({ error: 'Both selfie and cam images are required in the request body.' });
    }

    console.log('Serverless: Querying active models on user account...');

    // 1. Fetch available models dynamically from the user's Google AI Studio account
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${token}`);
    if (!modelsRes.ok) {
      throw new Error(`Failed to query Google Gemini models: HTTP ${modelsRes.status}`);
    }
    const modelsData = await modelsRes.json();
    const allModels = modelsData.models || [];

    // 2. Select the best image generation model available on their account
    let selectedModel = allModels.find(m => m.name.includes('flash-image') || m.name.includes('pro-image'));
    if (!selectedModel) {
      selectedModel = allModels.find(m => m.name.includes('imagen') || m.name.includes('image'));
    }

    if (!selectedModel) {
      // Fallback if no specific match
      selectedModel = { name: 'models/gemini-2.5-flash-image' };
    }

    const modelName = selectedModel.name;
    console.log(`Serverless: Dynamically selected model: ${modelName}`);

    // 3. Call the selected model
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${token}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt || "Please create a single, unified photograph of these two people posing together, standing side-by-side, smiling." },
              { 
                inlineData: { 
                  mimeType: "image/jpeg", 
                  data: selfie 
                } 
              },
              { 
                inlineData: { 
                  mimeType: "image/jpeg", 
                  data: cam 
                } 
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${response.status} from Google Gemini API`);
    }

    const data = await response.json();
    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!part) {
      throw new Error('Model returned success but no generated image data.');
    }

    const outputDataUri = `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
    console.log('Serverless: Image generation successful!');
    res.status(200).json({ imageUrl: outputDataUri });

  } catch (error) {
    console.error('Serverless Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during image generation.' });
  }
};
