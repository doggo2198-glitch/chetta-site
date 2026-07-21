import OpenAI from "openai";

export async function analyzeOpportunities(results, student) {

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You are a college admissions counselor who recommends extracurricular activities."
      },
      {
        role: "user",
        content: `
Student information:

Major: ${student.major}

Interests: ${student.interests.join(", ")}

Location:
${student.city}, ${student.country}


Here are the opportunities found:

${JSON.stringify(results)}


Analyze these opportunities and return ONLY JSON.

Format:

[
  {
    "name": "",
    "website": "",
    "description": "",
    "collegeImpact": 1,
    "skills": []
  }
]

Rank the best opportunities first.
`
      }
    ]
  });

  return response.choices[0].message.content;
}