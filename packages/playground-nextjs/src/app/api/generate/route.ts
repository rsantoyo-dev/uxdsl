import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.UXDSL_API_KEY;
    
    if (!apiKey) {
      console.error("API Key is missing in process.env");
      return NextResponse.json(
        { error: "API key not configured on server" },
        { status: 500 }
      );
    }

    console.log("Initializing Gemini with API Key starting with:", apiKey.substring(0, 4) + "...");
    
    const genAI = new GoogleGenerativeAI(apiKey);

    // Using gemini-2.5-flash as confirmed available for this API key
    const modelName = "gemini-2.5-flash"; 
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const SYSTEM_PROMPT = `
    You are a UX Design System expert. Your goal is to generate a UXDSL theme based on the user's description (e.g., "funky", "elegant", "dark", "nature", "cyberpunk").
    Return ONLY a raw JSON object (no markdown formatting) with the following structure. All fields must be present, even if empty or null where appropriate for the prompt.
    Generate cohesive values for colors, spacing, and typography. Use hex codes for colors and 'rem' or 'px' for spacing.

    JSON Structure:
    {
      "name": "string", // A creative name for this theme
      "fonts": {
        "google": [
          "string" // e.g., "Inter:wght@400;500;600;700"
        ],
        "families": {
          "ui": "string", // e.g., "Inter, sans-serif"
          "code": "string" // e.g., "monospace"
        }
      },
      "breakpoints": { // Standard breakpoint values (px)
        "xs": 0,
        "sm": 480,
        "md": 768,
        "lg": 1024,
        "xl": 1280
      },
      "palette": { // Base (light) mode palette
        "primary": {
          "main": "hex",
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        },
        "secondary": {
          "main": "hex",
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        },
        "surface": {
          "main": "hex", // Background
          "light": "hex",
          "dark": "hex",
          "contrast": "hex" // Text on surface
        },
        "tertiary": {
          "main": "hex",
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        },
        "success": {
          "main": "hex",
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        },
        "info": {
          "main": "hex",
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        },
        "warning": {
          "main": "hex",
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        },
        "error": {
          "main": "hex",
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        },
        "dark": {
          "main": "hex", // General dark shades
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        },
        "neutral": {
          "main": "hex",
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        },
        "light": {
          "main": "hex", // General light shades
          "light": "hex",
          "dark": "hex",
          "contrast": "hex"
        }
      },
      "modes": { // Dark mode overrides (only for palette for now)
        "dark": {
          "palette": {
            "primary": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "secondary": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "surface": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "neutral": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "tertiary": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "success": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "info": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "warning": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "error": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "light": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            },
            "dark": {
              "main": "hex",
              "light": "hex",
              "dark": "hex",
              "contrast": "hex"
            }
          }
        }
      },
      "spacing": { // rem or px values for 1-16
        "1": "string",
        "2": "string",
        "3": "string",
        "4": "string",
        "5": "string",
        "6": "string",
        "7": "string",
        "8": "string",
        "9": "string",
        "10": "string",
        "11": "string",
        "12": "string",
        "13": "string",
        "14": "string",
        "15": "string",
        "16": "string"
      },
      "typography": {
        "font-code": "string", // e.g., "monospace"
        "font-ui": "string" // e.g., "Inter, sans-serif"
      }
    }
    User Request:
    `;

    const fullPrompt = SYSTEM_PROMPT + prompt; // Removed "\nUser Request: " from here as it's already in SYSTEM_PROMPT
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error("Error generating content:", error);
    
    // Attempt to list models to help debug
    try {
        const apiKey = process.env.UXDSL_API_KEY;
        if (apiKey) {
            // Note: listModels is not directly available on genAI instance in all versions, 
            // but let's try to log a helpful message.
            console.log("If you are seeing a 404 for the model, please check if the Generative AI API is enabled in your Google Cloud Console.");
        }
    } catch {
        // ignore
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to generate content: ${errorMessage}` },
      { status: 500 }
    );
  }
}
