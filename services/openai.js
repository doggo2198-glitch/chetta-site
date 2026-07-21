import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function analyzeOpportunities(results, userInfo) {

  const response = await groq.chat.completions.create({

    model: "llama-3.1-8b-instant",

    messages: [
      {
        role: "system",
        content: `
You are a helpful university extracurricular advisor.
Return ONLY valid JSON.
`
      },

      {
        role: "user",
        content: `
Student information:

Major:
${userInfo.major}

Interests:
${userInfo.interests.join(", ")}

Location:
${userInfo.city}, ${userInfo.country}


Find the best opportunities from these results:

${JSON.stringify(results)}


Return JSON like:

{
  "opportunities": [
    {
      "name": "",
      "description": "",
      "why": ""
    }
  ]
}
`
      }
    ]

  });


  return response.choices[0].message.content;

}