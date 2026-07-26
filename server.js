import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { analyzeOpportunities } from "./services/openai.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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
Find extracurricular opportunities for HIGH SCHOOL STUDENTS.

Student Profile:
- Intended Major: ${major}
- Academic Interests: ${interests.join(", ")}
- Preferred Work Styles: ${(workStyles || []).join(", ")}
- Location: ${city}, ${country}

Look ONLY for opportunities located in or near ${city}, ${country}.

Examples:
- research programs
- research internships
- internships
- hackathons
- science competitions
- robotics competitions
- programming competitions
- engineering competitions
- math competitions
- volunteering
- NGOs
- youth organizations
- leadership programs
- STEM clubs
- community projects
- startup events
- workshops
- conferences
- summer programs

DO NOT include:
- universities
- colleges
- schools
- degree programs
- scholarships
- admissions information

Prefer organizations that provide contact information such as:
- email
- phone
- Telegram
- Instagram
- Facebook
- LinkedIn
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
                max_results: 20
            })
        });

        if (!response.ok) {
            throw new Error(`Tavily API Error: ${response.status}`);
        }

        const data = await response.json();

console.log("=== TAVILY RESULTS ===");
console.log(JSON.stringify(data.results, null, 2));
console.log("======================");

        const recommendations = await analyzeOpportunities(
            data.results,
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});