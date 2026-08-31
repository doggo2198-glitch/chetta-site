import "dotenv/config";

import express from "express";
import cors from "cors";

import { analyzeOpportunities } from "./services/openai.js";
import { analyzeProfile } from "./services/profileAnalyzer.js";
import { analyzeUniversities } from "./services/universityAnalyzer.js";
import { generateRoadmap } from "./services/roadmapAnalyzer.js";

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
            major = "",
            interests = [],
            workStyles = [],
            city = "",
            country = ""
        } = req.body;


        // Make sure these are actually arrays
        const safeInterests =
            Array.isArray(interests) ? interests : [];

        const safeWorkStyles =
            Array.isArray(workStyles) ? workStyles : [];


        console.log("Extracurricular request:", {
            major,
            interests: safeInterests,
            workStyles: safeWorkStyles,
            city,
            country
        });


        // ===============================
        // TAVILY SEARCH QUERY
        // ===============================

        const query = `

        ${major} extracurricular opportunities

        ${safeInterests.join(" ")}

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


        // ===============================
        // CHECK TAVILY RESPONSE
        // ===============================

        if (!response.ok) {

            const errorText = await response.text();

            console.error(
                "Tavily error:",
                response.status,
                errorText
            );

            throw new Error(
                `Tavily error: ${response.status}`
            );
        }


        const data = await response.json();


        console.log(
            "Tavily results:",
            data.results?.length || 0
        );


        // ===============================
        // VERIFY SEARCH RESULT URLS
        // ===============================

        const checkedResults = [];


        for (const result of data.results || []) {

            if (!result.url) {
                continue;
            }


            const valid = await verifyURL(result.url);


            if (valid) {

                checkedResults.push({

                    title: result.title,

                    url: result.url,

                    content:
                        result.content?.slice(0, 500) || ""

                });

            }

        }


        console.log(
            "Verified results:",
            checkedResults.length
        );


        // ===============================
        // AI ANALYSIS
        // ===============================

        const recommendations =
            await analyzeOpportunities(

                checkedResults,

                {
                    major,

                    interests: safeInterests,

                    workStyles: safeWorkStyles,

                    city,

                    country
                }

            );


        // ===============================
        // PARSE AI RESPONSE
        // ===============================

        let parsed;


        try {

            parsed = JSON.parse(recommendations);

        } catch (parseError) {

            console.error(
                "AI JSON parsing failed:",
                recommendations
            );

            throw new Error(
                "AI returned invalid JSON"
            );
        }


        // ===============================
        // RETURN RESULTS
        // ===============================

        res.json({

            recommendations:
                parsed.opportunities || []

        });

    } catch (error) {

        console.error(
            "Extracurricular search failed:",
            error
        );


        res.status(500).json({

            error:
                error.message ||
                "Something went wrong"

        });

    }

});


// ===============================
// PROFILE ANALYZER
// ===============================

app.post("/api/profile", async (req, res) => {

    try {

        const profile = req.body;

        const analysis =
            await analyzeProfile(profile);

        res.json({

            success: true,

            analysis

        });

    } catch (error) {

        console.error(
            "Profile analysis error:",
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message ||
                "Profile analysis failed"

        });

    }

});


// ===============================
// UNIVERSITY ANALYZER
// ===============================

app.post("/api/universities", async (req, res) => {

    try {

        const universities =
            await analyzeUniversities(req.body);

        res.json({

            success: true,

            universities

        });

    } catch (error) {

        console.error(
            "University analysis error:",
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message ||
                "University recommendation failed"

        });

    }

});


// ===============================
// UNIVERSITY ROADMAP
// ===============================

app.post("/api/roadmap", async (req, res) => {

    try {

        const roadmap =
            await generateRoadmap(req.body);


        let parsed;


        try {

            parsed = JSON.parse(roadmap);

        } catch (parseError) {

            console.error(
                "Roadmap JSON parsing failed:",
                roadmap
            );

            throw new Error(
                "Roadmap AI returned invalid JSON"
            );
        }


        res.json({

            success: true,

            roadmap: parsed

        });

    } catch (error) {

        console.error(
            "Roadmap error:",
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message ||
                "Roadmap generation failed"

        });

    }

});


// ===============================
// START SERVER
// ===============================

const PORT =
    process.env.PORT || 3000;


app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});