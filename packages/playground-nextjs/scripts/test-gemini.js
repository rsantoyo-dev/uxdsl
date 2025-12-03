const { GoogleGenerativeAI } = require("@google/generative-ai");

async function main() {
  const apiKey = "AIzaSyA0OyzHJ5Y5aA1MdRUjSwsWXKGk3tghZnY";
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const modelsToTest = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro", "gemini-pro"];
  
  console.log("Testing API Key permissions and Model availability...");

  try {
    console.log("\n--- Listing Available Models ---");
    // Note: listModels might not be available on the helper, but let's try the direct fetch if needed or use the SDK method if available.
    // The SDK exposes it via the GoogleGenerativeAI instance in newer versions, or we can try a simple fetch.
    // Let's try to just run a generation first as before, but if that fails, we can't easily list models with just the client in this version without a model instance.
    // Actually, let's try to use the API directly to list models to see if the KEY is valid at all.
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.error) {
        console.log(`❌ API Error when listing models: ${data.error.message}`);
        console.log(`   Reason: ${data.error.status}`);
        return;
    }
    
    if (data.models) {
        console.log(`✅ API Key is VALID. Found ${data.models.length} models.`);
        console.log("Available models for generateContent:");
        const generateModels = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace('models/', ''));
            
        console.log(generateModels.join(", "));
        
        if (generateModels.length > 0) {
            const modelName = generateModels[0];
            console.log(`\n--- Testing generation with '${modelName}' ---`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            console.log(`✅ SUCCESS! Response: ${await result.response.text()}`);
            return;
        }
    }
  } catch (e) {
      console.log("Error checking API:", e.message);
  }

  for (const modelName of modelsToTest) {
    console.log(`\n--- Testing ${modelName} ---`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello, are you working?");
      const response = await result.response;
      console.log(`✅ SUCCESS! Model '${modelName}' is working.`);
      console.log(`Response: ${response.text()}`);
      return; // Exit after finding a working model
    } catch (error) {
      console.log(`❌ FAILED: ${error.message.split('\n')[0]}`);
      if (error.message.includes("404")) {
        console.log("   (Model not found or API not enabled)");
      }
    }
  }
  
  console.log("\n❌ All models failed. Please check if 'Generative Language API' is enabled in Google Cloud Console.");
}

main();
