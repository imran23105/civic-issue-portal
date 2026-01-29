const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const OpenAI = require("openai");

// 🔥 THIS WAS MISSING
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


exports.analyzeImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    // 1️⃣ Always upload image
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "civic-issues" },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    const imageUrl = uploadResult.secure_url;
    console.log("✅ CLOUDINARY URL:", imageUrl);

    // 2️⃣ If AI key missing → skip AI
    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        title: "",
        description: "",
        category: "Other",
        imageUrl, // ✅ ALWAYS
      });
    }

    // 3️⃣ Try AI (BUT DO NOT FAIL REQUEST)
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await client.responses.create({
        model: "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "Analyze this civic issue image" },
            { type: "input_image", image_url: imageUrl }
          ]
        }]
      });

      const raw = response.output_text || "";
      const match = raw.match(/\{[\s\S]*\}/);

      if (!match) throw new Error("Bad AI JSON");

      const parsed = JSON.parse(match[0]);

      return res.json({
        title: parsed.title || "",
        description: parsed.description || "",
        category: parsed.category || "Other",
        imageUrl,
      });

    } catch (aiErr) {
      console.error("⚠️ AI FAILED, FALLING BACK", aiErr);

      // 🔥 IMPORTANT: still return imageUrl
      return res.json({
        title: "",
        description: "",
        category: "Other",
        imageUrl,
      });
    }

  } catch (err) {
    console.error("🔥 IMAGE UPLOAD FAILED:", err);
    return res.status(500).json({ error: "Image upload failed" });
  }
};
