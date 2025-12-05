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

    // Pre-selected list of 20 high-quality Google Fonts covering various styles
    const AVAILABLE_FONTS = [
      "Inter", "Roboto", "Poppins", "Open Sans", "Montserrat", "Lato", "Raleway", "Noto Sans",
      "Merriweather", "Playfair Display", "Lora", "PT Serif", "Roboto Slab",
      "Roboto Mono", "Source Code Pro", "JetBrains Mono", "Fira Code",
      "Oswald", "Quicksand", "Dancing Script"
    ];

    const SYSTEM_PROMPT = `
    You are a UX Design System expert. Your goal is to generate a UXDSL theme based on the user's description (e.g., "funky", "elegant", "dark", "nature", "cyberpunk").
    Return ONLY a raw JSON object (no markdown formatting) with the following structure. All fields must be present.
    
    IMPORTANT: For fonts, you MUST choose from the following available Google Fonts list. Select the best match for the requested style.
    Available Fonts: ${AVAILABLE_FONTS.join(", ")}

    JSON Structure:
    {
      "name": "string", // A creative name for this theme
      "backgroundImage": "string", // A short, descriptive English prompt for a background image matching the theme (e.g. "neon cyberpunk city", "calm misty forest")
      "fonts": {
        "google": [
          "string" // The Google Font import string, e.g., "Inter:wght@400;500;600;700" or "Playfair Display:wght@400;700"
        ],
        "families": {
          "ui": "string", // The font family name from the list above, e.g., "Inter, sans-serif"
          "code": "string" // A monospace font from the list or generic, e.g., "JetBrains Mono, monospace"
        }
      },
      "typography_details": {
        // Define line-height and letter-spacing for key elements.
        // Headings (h1-h6) usually have tighter line-height (1.1-1.3) and tracking (-0.02em).
        // Body text (p) usually has looser line-height (1.5-1.7).
        "h1": { "lineHeight": "string", "letterSpacing": "string" },
        "h2": { "lineHeight": "string", "letterSpacing": "string" },
        "h3": { "lineHeight": "string", "letterSpacing": "string" },
        "h4": { "lineHeight": "string", "letterSpacing": "string" },
        "h5": { "lineHeight": "string", "letterSpacing": "string" },
        "h6": { "lineHeight": "string", "letterSpacing": "string" },
        "p": { "lineHeight": "string", "letterSpacing": "string" },
        "body": { "lineHeight": "string", "letterSpacing": "string" },
        "caption": { "lineHeight": "string", "letterSpacing": "string" }
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
