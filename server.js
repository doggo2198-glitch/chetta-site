import "dotenv/config";

import express from "express";
import cors from "cors";

import { analyzeOpportunities } from "./services/openai.js";
import { analyzeProfile } from "./services/profileAnalyzer.js";
import { analyzeUniversities } from "./services/universityAnalyzer.js";
import { generateRoadmap } from "./services/roadmapAnalyzer.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));


// ============================================================
// HOME CHECK
// ============================================================

app.get("/", (req, res) => {
    res.json({
        status: "working",
        message: "Backend is running!"
    });
});


// ============================================================
// ENVIRONMENT TEST
// ============================================================

app.get("/test", (req, res) => {
    res.json({
        status: "working",
        groq: !!process.env.GROQ_API_KEY,
        tavily: !!process.env.TAVILY_API_KEY,
        openai: !!process.env.OPENAI_API_KEY
    });
});


// ============================================================
// GROQ MODEL TEST
// ============================================================

app.get("/test-groq", async (req, res) => {
    try {
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({
                success: false,
                error: "GROQ_API_KEY is missing"
            });
        }

        const response = await fetch(
            "https://api.groq.com/openai/v1/models",
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Groq models error:", data);

            return res.status(response.status).json({
                success: false,
                error: data
            });
        }

        const models = (data.data || []).map(model => ({
            id: model.id,
            active: model.active,
            owned_by: model.owned_by
        }));

        console.log("Available Groq models:", models);

        res.json({
            success: true,
            models
        });

    } catch (error) {
        console.error("Groq model test failed:", error);

        res.status(500).json({
            success: false,
            error:
                error.message ||
                "Could not retrieve Groq models"
        });
    }
});


// ============================================================
// VERIFY URL
// ============================================================
//
// Some websites block HEAD requests even though the URL works.
// Therefore we first try HEAD, then fall back to GET.
//
// ============================================================

async function verifyURL(url) {
    if (!url) {
        return false;
    }

    try {
        const headResponse = await fetch(url, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(8000)
        });

        if (headResponse.ok) {
            return true;
        }
    } catch (error) {
        // Try GET below
    }

    try {
        const getResponse = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(8000)
        });

        return getResponse.ok;

    } catch (error) {
        return false;
    }
}


// ============================================================
// CLEAN AI JSON
// ============================================================
//
// Handles:
// { ... }
//
// and:
//
// ```json
// { ... }
// ```
//
// ============================================================

function cleanAIJson(text) {
    if (typeof text !== "string") {
        return text;
    }

    let cleaned = text.trim();

    // Remove markdown code fences
    cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    // Sometimes the model puts text before/after JSON.
    // Try to extract the main JSON object.
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (
        firstBrace !== -1 &&
        lastBrace !== -1 &&
        lastBrace > firstBrace
    ) {
        cleaned =
            cleaned.slice(firstBrace, lastBrace + 1);
    }

    return cleaned;
}


// ============================================================
// EXTRACURRICULAR FINDER
// ============================================================

app.post("/api/opportunities", async (req, res) => {

    try {

        const {
            major = "",
            interests = [],
            workStyles = [],
            city = "",
            country = ""
        } = req.body;


        // --------------------------------------------------------
        // SAFE INPUTS
        // --------------------------------------------------------

        const safeInterests =
            Array.isArray(interests)
                ? interests.filter(Boolean)
                : [];

        const safeWorkStyles =
            Array.isArray(workStyles)
                ? workStyles.filter(Boolean)
                : [];


        console.log("\n======================================");
        console.log("EXTRACURRICULAR REQUEST");
        console.log("======================================");

        console.log({
            major,
            interests: safeInterests,
            workStyles: safeWorkStyles,
            city,
            country
        });


        // --------------------------------------------------------
        // CHECK TAVILY KEY
        // --------------------------------------------------------

        if (!process.env.TAVILY_API_KEY) {

            return res.status(500).json({
                success: false,
                error: "TAVILY_API_KEY is missing"
            });
        }


        // --------------------------------------------------------
        // CHECK GROQ KEY
        // --------------------------------------------------------

        if (!process.env.GROQ_API_KEY) {

            return res.status(500).json({
                success: false,
                error: "GROQ_API_KEY is missing"
            });
        }


        // --------------------------------------------------------
        // BUILD SEARCH QUERY
        // --------------------------------------------------------

        const query = `
${major}
${safeInterests.join(" ")}
${safeWorkStyles.join(" ")}
${city}, ${country}

extracurricular opportunities for high school students
research internships
student competitions
hackathons
volunteering
summer programs
academic programs
youth programs
student organizations
leadership programs
`;

        console.log("\nTavily query:");
        console.log(query);


        // --------------------------------------------------------
        // TAVILY SEARCH
        // --------------------------------------------------------

        const tavilyResponse = await fetch(
            "https://api.tavily.com/search",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    api_key:
                        process.env.TAVILY_API_KEY,

                    query,

                    search_depth: "advanced",

                    max_results: 8,

                    include_answer: false,

                    include_raw_content: false
                })
            }
        );


        // --------------------------------------------------------
        // TAVILY ERROR
        // --------------------------------------------------------

        if (!tavilyResponse.ok) {

            const errorText =
                await tavilyResponse.text();

            console.error(
                "Tavily error:",
                tavilyResponse.status,
                errorText
            );

            return res.status(500).json({
                success: false,
                error:
                    `Tavily error: ${tavilyResponse.status}`
            });
        }


        const tavilyData =
            await tavilyResponse.json();


        const tavilyResults =
            Array.isArray(tavilyData.results)
                ? tavilyData.results
                : [];


        console.log(
            "\nTavily results:",
            tavilyResults.length
        );


        // --------------------------------------------------------
        // PREPARE RESULTS
        // --------------------------------------------------------
        //
        // IMPORTANT:
        // Do not throw away Tavily results simply because HEAD
        // verification fails.
        //
        // We keep the original results and mark them as verified.
        //
        // --------------------------------------------------------

        const checkedResults = [];


        for (const result of tavilyResults) {

            if (!result?.url) {
                continue;
            }

            const valid =
                await verifyURL(result.url);

            checkedResults.push({

                title:
                    result.title ||
                    "Untitled opportunity",

                url:
                    result.url,

                content:
                    result.content
                        ?.slice(0, 1200) || "",

                verified: valid
            });
        }


        console.log(
            "Checked results:",
            checkedResults.length
        );

        console.log(
            "Verified results:",
            checkedResults.filter(
                result => result.verified
            ).length
        );


        // --------------------------------------------------------
        // IF TAVILY FOUND NOTHING
        // --------------------------------------------------------

        if (checkedResults.length === 0) {

            console.log(
                "No Tavily results found."
            );

            return res.json({
                success: true,
                recommendations: []
            });
        }


        // --------------------------------------------------------
        // SEND RESULTS TO AI
        // --------------------------------------------------------

        console.log(
            "\nSending results to Groq AI..."
        );


        const aiResults =
            await analyzeOpportunities(

                checkedResults,

                {
                    major,

                    interests:
                        safeInterests,

                    workStyles:
                        safeWorkStyles,

                    city,

                    country
                }
            );


        console.log(
            "\nRaw AI response:"
        );

        console.log(aiResults);


        // --------------------------------------------------------
        // PARSE AI RESPONSE
        // --------------------------------------------------------

        let parsed;

        try {

            const cleaned =
                cleanAIJson(aiResults);

            parsed =
                typeof cleaned === "string"
                    ? JSON.parse(cleaned)
                    : cleaned;

        } catch (parseError) {

            console.error(
                "\nAI JSON parsing failed."
            );

            console.error(
                "Raw response:",
                aiResults
            );

            // ----------------------------------------------------
            // FALLBACK
            // ----------------------------------------------------
            //
            // If AI produced invalid JSON, don't lose the Tavily
            // results. Return them directly.
            //
            // ----------------------------------------------------

            const fallback =
                checkedResults.map(result => ({
                    title: result.title,
                    url: result.url,
                    description: result.content
                }));

            return res.json({
                success: true,
                recommendations: fallback,
                fallback: true
            });
        }


        // --------------------------------------------------------
        // EXTRACT OPPORTUNITIES
        // --------------------------------------------------------

        let opportunities = [];


        if (Array.isArray(parsed)) {

            opportunities = parsed;

        } else if (
            parsed &&
            Array.isArray(parsed.opportunities)
        ) {

            opportunities =
                parsed.opportunities;

        } else if (
            parsed &&
            Array.isArray(parsed.recommendations)
        ) {

            opportunities =
                parsed.recommendations;
        }


        console.log(
            "\nAI opportunities:",
            opportunities.length
        );


        // --------------------------------------------------------
        // CRITICAL FALLBACK
        // --------------------------------------------------------
        //
        // If Tavily found real results but AI returned:
        //
        // {
        //   "opportunities": []
        // }
        //
        // we DO NOT tell the frontend "no opportunities".
        //
        // Instead, return the verified/search results.
        //
        // --------------------------------------------------------

        if (
            opportunities.length === 0 &&
            checkedResults.length > 0
        ) {

            console.log(
                "AI returned 0 opportunities."
            );

            console.log(
                "Using Tavily results as fallback."
            );


            opportunities =
                checkedResults.map(result => ({

                    title:
                        result.title,

                    url:
                        result.url,

                    description:
                        result.content,

                    verified:
                        result.verified
                }));
        }


        // --------------------------------------------------------
        // REMOVE DUPLICATES
        // --------------------------------------------------------

        const uniqueOpportunities = [];

        const seenUrls = new Set();


        for (const opportunity of opportunities) {

            if (!opportunity) {
                continue;
            }

            const url =
                opportunity.url ||
                opportunity.link ||
                "";


            if (
                url &&
                seenUrls.has(url)
            ) {
                continue;
            }


            if (url) {
                seenUrls.add(url);
            }


            uniqueOpportunities.push(
                opportunity
            );
        }


        // --------------------------------------------------------
        // RETURN RESULTS
        // --------------------------------------------------------

        console.log(
            "\nFinal opportunities:",
            uniqueOpportunities.length
        );

        console.log(
            "======================================\n"
        );


        return res.json({

            success: true,

            recommendations:
                uniqueOpportunities

        });


    } catch (error) {

        console.error(
            "\nExtracurricular search failed:"
        );

        console.error(error);


        return res.status(500).json({

            success: false,

            error:
                error.message ||
                "Something went wrong"

        });
    }
});


// ============================================================
// PROFILE ANALYZER
// ============================================================

app.post("/api/profile", async (req, res) => {

    try {

        const profile =
            req.body;

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


// ============================================================
// UNIVERSITY ANALYZER
// ============================================================

app.post("/api/universities", async (req, res) => {

    try {

        const universities =
            await analyzeUniversities(
                req.body
            );

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


// ============================================================
// UNIVERSITY ROADMAP
// ============================================================

app.post("/api/roadmap", async (req, res) => {

    try {

        console.log(
            "Roadmap request received"
        );

        const roadmap =
            await generateRoadmap(
                req.body
            );


        // --------------------------------------------------------
        // PARSE AI RESPONSE
        // --------------------------------------------------------

        let parsed;

        try {

            if (typeof roadmap === "string") {

                const cleaned =
                    cleanAIJson(roadmap);

                parsed =
                    JSON.parse(cleaned);

            } else {

                parsed = roadmap;

            }

        } catch (parseError) {

            console.error(
                "Roadmap JSON parsing failed:"
            );

            console.error(roadmap);

            throw new Error(
                "Roadmap AI returned invalid JSON"
            );
        }


        // --------------------------------------------------------
        // RETURN ROADMAP
        // --------------------------------------------------------

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


// ============================================================
// START SERVER
// ============================================================

const PORT =
    process.env.PORT || 3000;


app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});