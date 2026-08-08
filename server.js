import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import { analyzeOpportunities } from "./services/openai.js";
import { analyzeProfile } from "./services/profileAnalyzer.js";
import { analyzeUniversities } from "./services/universityAnalyzer.js";
import { generateRoadmap } from "./services/roadmapAnalyzer.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


// ===============================
// HOME CHECK
// ===============================

app.get("/", (req, res) => {

    res.send("Backend is running!");

});


// ===============================
// RENDER ENVIRONMENT TEST
// ===============================

app.get("/test", (req, res) => {

    res.json({

        status: "working",

        groq: !!process.env.GROQ_API_KEY,

        tavily: !!process.env.TAVILY_API_KEY,

        openai: !!process.env.OPENAI_API_KEY

    });

});


// ===============================
// VERIFY URL
// ===============================

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


// ===============================
// EXTRACURRICULAR FINDER
// ===============================

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


        const response = await fetch(

            "https://api.tavily.com/search",

            {

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

            }

        );


        if (!response.ok) {

            throw new Error(
                `Tavily error: ${response.status}`
            );

        }


        const data = await response.json();


        const checkedResults = [];


        for (const result of data.results) {

            const valid = await verifyURL(result.url);


            if (valid) {

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


        res.json({

            recommendations:
                parsed.opportunities

        });


    } catch (error) {

        console.error(error);


        res.status(500).json({

            error: "Something went wrong"

        });

    }

});


// ===============================
// PROFILE ANALYZER
// ===============================

app.post("/api/profile", async (req, res) => {

    try {

        const profile = req.body;


        const analysis = await analyzeProfile(profile);


        res.json({

            success: true,

            analysis

        });


    } catch (error) {

        console.error(error);


        res.status(500).json({

            success: false,

            error: "Profile analysis failed"

        });

    }

});


// ===============================
// UNIVERSITY ANALYZER
// ===============================

app.post("/api/universities", async (req, res) => {

    try {

        const universities = await analyzeUniversities(req.body);


        res.json({

            success: true,

            universities

        });


    } catch (error) {

        console.error(error);


        res.status(500).json({

            success: false,

            error: "University recommendation failed"

        });

    }

});


// ===============================
// UNIVERSITY ROADMAP
// ===============================

app.post("/api/roadmap", async (req, res) => {

    try {

        const roadmap = await generateRoadmap(req.body);


        const parsed = JSON.parse(roadmap);


        res.json({

            success: true,

            roadmap: parsed

        });


    } catch (error) {

        console.error("Roadmap error:", error);


        res.status(500).json({

            success: false,

            error: "Roadmap generation failed"

        });

    }

});


// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});