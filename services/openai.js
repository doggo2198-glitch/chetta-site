import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

export async function analyzeOpportunities(results, userInfo) {

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash"
  });

  const prompt = `
You are a helpful university extracurricular advisor.

Student information:
Major: ${userInfo.major}
Interests: ${userInfo.interests.join(", ")}
Location: ${userInfo.city}, ${userInfo.country}

Based on these search results:

${JSON.stringify(results)}

Return ONLY valid JSON in this format:

{
  "opportunities": [
    {
      "name": "Opportunity name",
      "description": "Short description",
      "why": "Why this fits the student"
    }
  ]
}
`;

  const response = await model.generateContent(prompt);

  return response.response.text();
}