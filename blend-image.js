const { GoogleGenAI } = require('@google/genai');

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

    const ai = new GoogleGenAI({ apiKey: token });
    console.log('Serverless: Calling Google Gen AI Nano Banana image model...');
    
    let interaction;
    try {
      interaction = await ai.interactions.create({
        model: "gemini-2.5-flash-image",
        input: [
          { type: "text", text: prompt || "Please create a single, unified photograph of these two people posing together, standing side-by-side, smiling." },
          { 
            type: "image", 
            data: selfie, 
            mime_type: "image/jpeg"
          },
          {
            type: "image", 
            data: cam, 
            mime_type: "image/jpeg"
          }
        ]
      });
    } catch (modelErr) {
      console.warn("Serverless: Failed with gemini-2.5-flash-image, trying fallback...", modelErr.message);
      interaction = await ai.interactions.create({
        model: "imagen-3.0-generate-002",
        input: [
          { type: "text", text: prompt || "Please create a single, unified photograph of these two people posing together, standing side-by-side, smiling." },
          { 
            type: "image", 
            data: selfie, 
            mime_type: "image/jpeg"
          },
          {
            type: "image", 
            data: cam, 
            mime_type: "image/jpeg"
          }
        ]
      });
    }

    if (interaction && interaction.output_image && interaction.output_image.data) {
      const outputDataUri = `data:image/jpeg;base64,${interaction.output_image.data}`;
      console.log('Serverless: Image generation successful!');
      res.status(200).json({ imageUrl: outputDataUri });
    } else {
      console.error('Serverless: Interaction response did not contain output image:', interaction);
      throw new Error('Unexpected output format from Google Gen AI image model');
    }

  } catch (error) {
    console.error('Serverless Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during image generation.' });
  }
};
