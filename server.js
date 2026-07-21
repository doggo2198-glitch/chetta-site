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

        const { major, interests, city, country } = req.body;


        const query = `
        extracurricular activities for ${major}
        students interested in ${interests.join(", ")}
        in ${city}, ${country}
        `;


        const response = await fetch("https://api.tavily.com/search", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                api_key: process.env.TAVILY_API_KEY,

                query: query,

                search_depth: "advanced",

                max_results: 5

            })

        });


        const data = await response.json();


        const recommendations = await analyzeOpportunities(
            data.results,
            {
                major,
                interests,
                city,
                country
            }
        );


        const parsed = JSON.parse(recommendations);


        res.json({
            recommendations: parsed.opportunities
        });


    } catch(error) {

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