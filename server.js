import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { analyzeProfile } from "./services/profileAnalyzer.js";
import { analyzeOpportunities } from "./services/openai.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


async function verifyURL(url) {
    try {
        const response = await fetch(url, {
            method: "HEAD",
            redirect: "follow"
        });

        return response.ok;

    } catch (error) {
        return false;
    }
}


app.get("/", (req, res) => {
    res.send("Backend is running!");
});


app.post("/api/opportunities", async (req, res) => {
    try {

        const {
            major,
            interests,
            workStyles,
            city,
            country
        } = req.body;


        const query = `
${major} extracurricular opportunities
${interests.join(" ")}
${city}, ${country}
high school students
research internships competitions hackathons volunteering programs
`;


        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                api_key: process.env.TAVILY_API_KEY,
                query,
                search_depth: "advanced",
                max_results: 8
            })
        });


        if (!response.ok) {

            const errorText = await response.text();

            console.log("=== TAVILY ERROR ===");
            console.log(errorText);
            console.log("====================");

            throw new Error(`Tavily API Error: ${response.status}`);
        }


        const data = await response.json();


        const checkedResults = [];


        for (const result of data.results) {

            const isValid = await verifyURL(result.url);

            if (isValid) {

                checkedResults.push({
                    title: result.title,
                    url: result.url,
                    content: result.content?.slice(0, 500)
                });

            }
        }


        const recommendations = await analyzeOpportunities(
            checkedResults,
            {
                major,
                interests,
                workStyles,
                city,
                country
            }
        );


        const parsed = JSON.parse(recommendations);


        const filtered = parsed.opportunities.filter(opportunity => {

            const hasSource =
                opportunity.source &&
                opportunity.source.trim() !== "";


            const hasContact =
                opportunity.contact &&
                opportunity.contact.type &&
                opportunity.contact.value &&
                opportunity.contact.type !== "Not available" &&
                opportunity.contact.value !== "Not available";


            return hasSource && hasContact;

        });


        res.json({
            recommendations: filtered
        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Something went wrong"
        });

    }
});



// NEW FEATURE: Admission Profile Analyzer
app.post("/api/profile", async (req, res) => {

    try {

        const profile = req.body;

        const analysis = await analyzeProfile(profile);

        const parsed = JSON.parse(analysis);

        res.json({
            success: true,
            analysis: parsed
        });


    } catch(error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Profile analysis failed"
        });

    }

});
const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});