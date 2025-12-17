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

    const { prompt, mode } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Pre-selected list of 20 high-quality Google Fonts covering various styles
    const AVAILABLE_FONTS = [
      // Sans Serif
      "Inter", "Roboto", "Poppins", "Open Sans", "Montserrat", "Lato", "Raleway", "Noto Sans", "Oswald", "Quicksand",
      // Serif
      "Merriweather", "Playfair Display", "Lora", "PT Serif", "Roboto Slab", "Cinzel", "Cormorant Garamond",
      // Monospace
      "Roboto Mono", "Source Code Pro", "JetBrains Mono", "Fira Code", "Space Mono",
      // Display / Handwriting / Creative
      "Dancing Script", "Pacifico", "Lobster", "Abril Fatface", "Righteous", "Fredoka One", "Press Start 2P", "Creepster", "Rye", "Spirax", "Bangers", "Permanent Marker"
    ];

    const THEME_SYSTEM_PROMPT = `
    You are a UX Design System expert. Your goal is to generate a UXDSL theme based on the user's description (e.g., "funky", "elegant", "dark", "nature", "cyberpunk").
    Return ONLY a raw JSON object (no markdown formatting) with the following structure. All fields must be present.
    
    IMPORTANT: For fonts, you MUST choose from the following available Google Fonts list. Select the best match for the requested style.
    Available Fonts: ${AVAILABLE_FONTS.join(", ")}

	    CRITICAL TYPOGRAPHY RULES:
	    1. "fontSize" MUST use the responsive syntax 'xs(val) sm(val) md(val) lg(val) xl(val)'.
	    2. "lineHeight" can also be responsive (e.g., 'xs(1.4) md(1.2)') or static. 
	       IMPORTANT: Ensure line height accommodates the font's ascenders/descenders. Script/Display fonts need more space (1.3-1.5) to avoid clipping. Sans-serifs can be tighter (1.1-1.2).
	    3. Adjust 'fontWeight' (100-900), 'letterSpacing' (e.g., -0.05em for tight display), 'textTransform', 'fontStyle', and 'textDecoration' to match the theme.
	    4. "fontSize" values MUST be in rem units (e.g. xs(1rem) md(1.125rem)). Do NOT use px.

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
        // Define detailed typography settings for key elements.
        "h1": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string" },
        "h2": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string" },
        "h3": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string" },
        "h4": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string" },
        "h5": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string" },
        "h6": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string" },
        "p": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string" },
        "body": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string" },
        "caption": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string" }
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

    const TYPOGRAPHY_PATCH_SYSTEM_PROMPT = `
    You are a UX Design System typography expert.
    Return ONLY a raw JSON object (no markdown formatting).

    The user request is ALWAYS about patching an existing theme's typography.
    Output shape must be:
    {
      "typography_details": {
        "h1": { "fontSize": "string", "lineHeight": "string", "letterSpacing": "string", "fontWeight": "string", "fontFamily": "string", "textTransform": "string", "textDecoration": "string", "fontStyle": "string", "marginBlockStart": "string", "marginBlockEnd": "string" }
      }
    }

	    Rules:
	    - fontSize MUST be responsive and include at least xs(...) and md(...). Prefer including sm/lg/xl.
	    - fontSize values MUST be in rem units (e.g. xs(1rem) md(1.25rem)). Do NOT use px.
	    - lineHeight MUST be responsive and include at least xs(...) and md(...).
	    - fontWeight must be a string number 100-900.
	    - fontFamily must respect the theme's current fonts unless the user explicitly requests a change.
	    - Keep hierarchy sane for headings when returning multiple tags.

    Available Fonts: ${AVAILABLE_FONTS.join(", ")}

    User Request:
    `;

  const systemPrompt = mode === 'typography_patch' ? TYPOGRAPHY_PATCH_SYSTEM_PROMPT : THEME_SYSTEM_PROMPT;
  const fullPrompt = systemPrompt + prompt;
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
