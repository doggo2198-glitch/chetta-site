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
Do not include markdown.
Do not include explanations outside JSON.

The JSON must follow this exact structure:

{
  "opportunities": [
    {
      "name": "Activity name",
      "description": "Short description",
      "collegeImpact": 1,
      "skills": ["skill1", "skill2"],
      "website": "https://example.com"
    }
  ]
}
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


Find the best extracurricular opportunities from these search results:


${JSON.stringify(results)}


Return only the JSON format requested.

`

            }

        ]

    });



    let text = response.choices[0].message.content;


    text = text.replace(/```json/g, "");

    text = text.replace(/```/g, "");


    return text.trim();

}