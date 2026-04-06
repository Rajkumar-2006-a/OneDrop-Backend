const { Groq } = require("groq-sdk");
const db = require("../config/db");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const aiController = {
  processMessage: async (req, res) => {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ response_message: "Message required" });
      }

      // 1️⃣ Ask AI to extract structured info
      const extractCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an assistant for a blood donation system. Extract the following fields from the user message and return ONLY JSON.\n\nFields:\nintent (greeting, find_donor, eligibility, camp, general)\nblood_group (A+,A-,B+,B-,AB+,AB-,O+,O- or null)\nlocation (city name or null)\n\nExample JSON:\n{\n "intent":"find_donor",\n "blood_group":"A+",\n "location":"Chennai"\n}`
          },
          {
            role: "user",
            content: message
          }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
      });

      let aiText = extractCompletion.choices[0]?.message?.content || "{}";

      let parsed;
      try {
        parsed = JSON.parse(aiText);
      } catch (e) {
        parsed = { intent: "general", blood_group: null, location: null };
      }

      const { intent, blood_group, location } = parsed;

      // 2️⃣ Greeting
      if (intent === "greeting") {
        return res.json({
          response_message:
            "Hello! I am your AI Blood Assistant 🩸. I can help you find blood donors or answer questions."
        });
      }

      // 3️⃣ Eligibility rules
      if (intent === "eligibility") {
        return res.json({
          response_message:
            "Blood Donation Rules:\n\n• Age: 18-65\n• Weight: Minimum 50kg\n• Must be healthy\n• 3 months gap between donations"
        });
      }

      // 4️⃣ Donor Search
      if (intent === "find_donor" && blood_group) {

        let query =
          "SELECT name, blood_group, location, contact FROM users WHERE blood_group=?";
        let params = [blood_group];

        if (location) {
          query += " AND location=?";
          params.push(location);
        }

        let [donors] = await db.query(query, params);

        if (donors.length === 0 && location) {
          // Fallback: Ask AI for district and nearby areas
          const fallbackCompletion = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content: "The user searched for blood donors in a specific location, but none were found. Provide the name of the District this location belongs to, and a list of up to 5 nearby major towns or areas in the same district. Return ONLY JSON format: {\"district\": \"District Name\", \"nearby\": [\"Area1\", \"Area2\"]}"
              },
              {
                role: "user",
                content: location
              }
            ],
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" },
          });

          let fallbackData = {};
          try {
            fallbackData = JSON.parse(fallbackCompletion.choices[0]?.message?.content || "{}");
          } catch (e) {
            console.error("AI Fallback Parse Error:", e);
          }

          const searchLocations = [];
          if (fallbackData.district) searchLocations.push(fallbackData.district);
          if (Array.isArray(fallbackData.nearby)) searchLocations.push(...fallbackData.nearby);

          if (searchLocations.length > 0) {
            const placeholders = searchLocations.map(() => '?').join(',');
            const fallbackQuery = `SELECT name, blood_group, location, contact FROM users WHERE blood_group=? AND location IN (${placeholders})`;
            const fallbackParams = [blood_group, ...searchLocations];

            const [fallbackDonors] = await db.query(fallbackQuery, fallbackParams);
            donors = fallbackDonors;

            if (donors.length > 0) {
              const donorList = donors
                .slice(0, 5)
                .map(
                  d =>
                    `👤 ${d.name} (${d.blood_group})\n📍 ${d.location}\n📞 ${d.contact}`
                )
                .join("\n\n");

              return res.json({
                response_message: `🩸 No donors found in exact location '${location}'. However, we found ${donors.length} donor(s) in the ${fallbackData.district || 'nearby'} district / nearby areas:\n\n${donorList}`
              });
            }
          }
        }

        if (donors.length === 0) {
          return res.json({
            response_message: "No donors found matching your exact location or nearby districts."
          });
        }

        const donorList = donors
          .slice(0, 5)
          .map(
            d =>
              `👤 ${d.name} (${d.blood_group})\n📍 ${d.location}\n📞 ${d.contact}`
          )
          .join("\n\n");

        return res.json({
          response_message: `🩸 Found ${donors.length} donor(s):\n\n${donorList}`
        });
      }

      // 5️⃣ Blood Camp Info
      if (intent === "camp") {
        return res.json({
          response_message:
            "To organize a blood donation camp, please use the 'Organize Camp' option on the dashboard."
        });
      }

      // 6️⃣ General AI response (fallback)
      const aiReplyCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a helpful navigational and conversational assistant for a Blood Donation platform. Please answer the user strictly in plain, conversational text. NEVER output JSON. NEVER output markdown code blocks. Always respond warmly as a human assistant."
          },
          {
            role: "user",
            content: message
          }
        ],
        model: "llama-3.1-8b-instant",
      });

      return res.json({
        response_message: aiReplyCompletion.choices[0]?.message?.content?.replace(/```json/g, '').replace(/```/g, '').trim() || "Sorry, I could not process your request."
      });

    } catch (error) {
      console.error("AI Error Message:", error.message);
      console.error("AI Error Status:", error.status);
      console.error("AI Error Details:", JSON.stringify(error.error || {}, null, 2));
      res.json({
        response_message: `Error: ${error.message}`
      });
    }
  }
};

module.exports = aiController;