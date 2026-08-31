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
// HOME
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
                headers: {
                    Authorization:
                        `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: data
            });
        }

        res.json({
            success: true,
            models: (data.data || []).map(model => ({
                id: model.id,
                active: model.active,
                owned_by: model.owned_by
            }))
        });

    } catch (error) {
        console.error("Groq test failed:", error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ============================================================
// URL VERIFICATION
// ============================================================

async function verifyURL(url) {
    if (!url) return false;

    try {
        const response = await fetch(url, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(8000)
        });

        if (response.ok) {
            return true;
        }
    } catch {
        // Try GET
    }

    try {
        const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(8000)
        });

        return response.ok;

    } catch {
        return false;
    }
}


// ============================================================
// CLEAN AI JSON
// ============================================================

function cleanAIJson(text) {
    if (typeof text !== "string") {
        return text;
    }

    let cleaned = text.trim();

    cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

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
// EXTRACURRICULAR OPPORTUNITIES
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


        const safeInterests =
            Array.isArray(interests)
                ? interests.filter(Boolean)
                : [];

        const safeWorkStyles =
            Array.isArray(workStyles)
                ? workStyles.filter(Boolean)
                : [];


        console.log("\n================================");
        console.log("OPPORTUNITY SEARCH");
        console.log("================================");

        console.log({
            major,
            interests: safeInterests,
            workStyles: safeWorkStyles,
            city,
            country
        });


        if (!process.env.TAVILY_API_KEY) {
            return res.status(500).json({
                success: false,
                error: "TAVILY_API_KEY is missing"
            });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({
                success: false,
                error: "GROQ_API_KEY is missing"
            });
        }


        // --------------------------------------------------------
        // TAVILY QUERY
        // --------------------------------------------------------

        const query = `
${major}
${safeInterests.join(" ")}
${safeWorkStyles.join(" ")}

${city}, ${country}

high school extracurricular opportunities
research internships
student competitions
hackathons
volunteering
youth programs
leadership programs
summer programs
student organizations
`;

        console.log("Tavily query:", query);


        // --------------------------------------------------------
        // TAVILY
        // --------------------------------------------------------

        const tavilyResponse =
            await fetch(
                "https://api.tavily.com/search",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        api_key:
                            process.env.TAVILY_API_KEY,

                        query,

                        search_depth:
                            "advanced",

                        max_results: 8,

                        include_answer:
                            false,

                        include_raw_content:
                            false
                    })
                }
            );


        if (!tavilyResponse.ok) {

            const errorText =
                await tavilyResponse.text();

            console.error(
                "Tavily error:",
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
            Array.isArray(
                tavilyData.results
            )
                ? tavilyData.results
                : [];


        console.log(
            "Tavily results:",
            tavilyResults.length
        );


        // --------------------------------------------------------
        // VERIFY URLs
        // --------------------------------------------------------

        const checkedResults = [];

        for (
            const result
            of tavilyResults
        ) {

            if (!result?.url) {
                continue;
            }

            const verified =
                await verifyURL(
                    result.url
                );

            checkedResults.push({

                title:
                    result.title ||
                    "Untitled opportunity",

                url:
                    result.url,

                content:
                    result.content
                        ?.slice(0, 1200) || "",

                verified
            });
        }


        console.log(
            "Checked results:",
            checkedResults.length
        );

        console.log(
            "Verified results:",
            checkedResults.filter(
                x => x.verified
            ).length
        );


        if (checkedResults.length === 0) {

            return res.json({
                success: true,
                recommendations: []
            });
        }


        // --------------------------------------------------------
        // GROQ ANALYSIS
        // --------------------------------------------------------

        const aiResponse =
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


        let parsed;

        try {

            parsed =
                JSON.parse(
                    cleanAIJson(
                        aiResponse
                    )
                );

        } catch {

            console.error(
                "AI JSON error:",
                aiResponse
            );

            throw new Error(
                "AI returned invalid JSON"
            );
        }


        let opportunities =
            Array.isArray(
                parsed.opportunities
            )
                ? parsed.opportunities
                : [];


        // --------------------------------------------------------
        // FALLBACK
        // --------------------------------------------------------

        if (
            opportunities.length === 0 &&
            checkedResults.length > 0
        ) {

            console.log(
                "AI returned 0 opportunities."
            );

            console.log(
                "Using Tavily fallback."
            );


            opportunities =
                checkedResults
                    .slice(0, 6)
                    .map(result => ({

                        name:
                            result.title,

                        description:
                            result.content,

                        category:
                            "Extracurricular",

                        location:
                            city ||
                            country ||
                            "Unknown",

                        whyRecommended:
                            "Found through the extracurricular opportunity search.",

                        skills: [],

                        contact: {
                            type:
                                "Not provided",
                            value:
                                "Not provided"
                        },

                        source:
                            result.url
                    }));
        }


        console.log(
            "Final opportunities:",
            opportunities.length
        );


        res.json({

            success: true,

            recommendations:
                opportunities

        });


    } catch (error) {

        console.error(
            "Extracurricular search failed:",
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message ||
                "Something went wrong"

        });
    }
});


// ============================================================
// PROFILE
// ============================================================

app.post("/api/profile", async (req, res) => {

    try {

        const analysis =
            await analyzeProfile(
                req.body
            );

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
// UNIVERSITIES
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
// ROADMAP
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


        let parsed;

        try {

            parsed =
                typeof roadmap === "string"
                    ? JSON.parse(
                        cleanAIJson(
                            roadmap
                        )
                    )
                    : roadmap;

        } catch {

            console.error(
                "Roadmap JSON error:",
                roadmap
            );

            throw new Error(
                "Roadmap AI returned invalid JSON"
            );
        }


        res.json({

            success: true,

            roadmap:
                parsed

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