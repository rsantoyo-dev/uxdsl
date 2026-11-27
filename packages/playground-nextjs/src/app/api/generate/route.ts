import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerationConfig } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { baseTheme } from "../../../../themes";
import { FONT_CATALOG, FONT_NAMES, sanitizeGeneratedTheme } from "../../../lib/generated-theme";

// Two callers: "Name a theme" on the home page (no `mode`), which gets `{ name, theme }`, an
// override already checked for this site (src/lib/generated-theme.js); and the Typography
// page's optimizer (`mode: 'typography_patch'`), which gets the model's text as `{ text }`.

const MODEL = "gemini-2.5-flash";
const MAX_PROMPT = 200;
const MAX_PATCH_PROMPT = 20_000;
// One answer, and one more when the first is unusable, inside the time a function may run.
export const maxDuration = 60;
const DEADLINE_MS = 52_000;
const RETRY_NEEDS_MS = 12_000;

const THEME_INSTRUCTION = `
You choose the fonts and colors of a website theme from a short description by the user (for example "Ocean", "cyberpunk", "elegant bakery").
Answer with one JSON object and nothing else, in exactly this shape:

{
  "name": "a short creative name for the theme, at most 4 words",
  "fonts": {
    "google": ["Lato:wght@400;700", "Lora:wght@600;700", "JetBrains Mono:wght@400"],
    "families": { "ui": "Lato, sans-serif", "code": "JetBrains Mono, monospace" }
  },
  "typography_details": {
    "h1": { "fontFamily": "Lora, serif", "fontWeight": "700", "letterSpacing": "-0.02em" },
    "h2": { "fontFamily": "Lora, serif", "fontWeight": "600", "letterSpacing": "-0.01em" },
    "h3": { "fontFamily": "Lora, serif", "fontWeight": "600", "letterSpacing": "normal" }
  },
  "palette": {
    "primary": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" },
    "secondary": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" },
    "tertiary": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" },
    "neutral": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" },
    "surface": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" }
  },
  "modes": {
    "dark": {
      "palette": {
        "primary": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" },
        "secondary": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" },
        "tertiary": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" },
        "neutral": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" },
        "surface": { "main": "#hex", "light": "#hex", "dark": "#hex", "contrast": "#hex" }
      }
    }
  }
}

Fonts
- Use only families of this list, written exactly, and only the weights each one has:
${FONT_CATALOG.join("\n")}
- "families.ui" is the font of all running text: choose one that reads well in paragraphs. "families.code" is a monospace family.
- A display or handwriting family belongs in headings (h1 to h3) only. At most three families in all: text, headings, code.
- "fontWeight" is a string such as "700". "letterSpacing" is "normal" or an em value between -0.05em and 0.1em.
- No font sizes, line heights, margins, spacing or breakpoints: the site keeps its own.

Colors
- Six-digit hex values. "palette" is light mode and "modes.dark.palette" is dark mode, with the same five families, each with main, light, dark and contrast.
- Light mode is always light, also for a theme that sounds dark ("Midnight"): "surface.main" is the page background, near white and tinted toward the theme; "surface.contrast" is the text on it, near black. Carry the theme in the accents and in the tint.
- Dark mode is always dark: "surface.main" is very dark, tinted toward the theme; "surface.contrast" is near white.
- "surface.light" is the background of cards, close to "surface.main". "surface.dark" is the color of borders and dividers: visible on the page, not a second background.
- "primary", "secondary" and "tertiary" are three accents that differ. "main" is drawn as text and as a button background on the page, so it needs a contrast of at least 4.5:1 against "surface.main" of its mode: deep and saturated in light mode, light and vivid in dark mode. "dark" is the same hue, used on hover. "light" is a soft variant. "contrast" is the text on "main": white or near black, whichever reads.
- "neutral" is a gray tinted toward the theme, for secondary text and quiet borders.
`;

const typographyPatchInstruction = () => `
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
    - fontSize values can be any valid CSS length OR a spacing token space(N). N is one of these keys, written exactly (no decimals, nothing above 16): ${Object.entries(baseTheme.spacing as Record<string, string>).map(([key, value]) => `${key} = ${value}`).join(", ")}. Prefer space() so typography is driven by the spacing system. Avoid calc(); if you need scaling, jump between breakpoints using different space(N) values.
    - lineHeight MUST be responsive and include at least xs(...) and md(...).
    - fontWeight must be a string number 100-900.
    - fontFamily must respect the theme's current fonts unless the user explicitly requests a change.
    - Keep hierarchy sane for headings when returning multiple tags.

    Available Fonts: ${FONT_NAMES.join(", ")}

    User Request:
    `;

type Ask = { instruction: string; request: string; timeout: number };

/** The model's text for one request. Thinking is switched off: this is a fill-in-the-shape task. */
async function ask(genAI: GoogleGenerativeAI, { instruction, request, timeout }: Ask): Promise<string> {
  const generate = async (generationConfig: GenerationConfig) => {
    const model = genAI.getGenerativeModel({ model: MODEL, systemInstruction: instruction, generationConfig }, { timeout });
    const result = await model.generateContent(request);
    return result.response.text();
  };
  const json = { responseMimeType: "application/json" };
  try {
    // `thinkingConfig` is not in this SDK's types; it sends the object to the API as it is.
    return await generate({ ...json, thinkingConfig: { thinkingBudget: 0 } } as GenerationConfig);
  } catch (error) {
    // An API that does not take the field answers 400; anything else is not about it.
    if ((error as { status?: number } | null)?.status !== 400) throw error;
    return generate(json);
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.UXDSL_API_KEY;
  if (!apiKey) {
    console.error("UXDSL_API_KEY is not set");
    return NextResponse.json({ error: "Theme generation is not configured on this server." }, { status: 500 });
  }

  let body: { prompt?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The request is not JSON." }, { status: 400 });
  }
  const typographyPatch = body?.mode === "typography_patch";
  // The Typography optimizer sends its own instructions as the prompt; a theme is named in a line.
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, typographyPatch ? MAX_PATCH_PROMPT : MAX_PROMPT) : "";
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  const started = Date.now();
  const remaining = () => DEADLINE_MS - (Date.now() - started);
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    if (typographyPatch) {
      const text = await ask(genAI, { instruction: typographyPatchInstruction(), request: prompt, timeout: remaining() });
      return NextResponse.json({ text });
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0 && remaining() < RETRY_NEEDS_MS) break;
      const text = await ask(genAI, { instruction: THEME_INSTRUCTION, request: `Theme: ${prompt}`, timeout: remaining() });
      const result = sanitizeGeneratedTheme(text, { fallbackName: prompt });
      if (result.ok) return NextResponse.json({ name: result.name, theme: result.theme });
      console.error(`Unusable theme answer (attempt ${attempt + 1}): ${result.reason}`);
    }
    return NextResponse.json({ error: "The model did not return a usable theme. Try again, or try another name." }, { status: 502 });
  } catch (error: unknown) {
    console.error("Error generating content:", error);
    const status = (error as { status?: number } | null)?.status;
    const message = status === 429
      ? "Too many themes are being made right now. Try again in a minute."
      : remaining() <= 0 || (error instanceof Error && /timed? ?out|abort/i.test(error.message))
        ? "The model took too long to answer. Try again."
        : typographyPatch ? "The model could not answer. Try again." : "The theme could not be made. Try again.";
    return NextResponse.json({ error: message }, { status: status === 429 ? 429 : 500 });
  }
}
