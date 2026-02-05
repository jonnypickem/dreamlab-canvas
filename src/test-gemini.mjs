/**
 * Quick test for Gemini Vision API
 * Run with: VITE_GEMINI_API_KEY=your_key node src/test-gemini.mjs
 * Or: source .env && node src/test-gemini.mjs
 */

// Simple test image (1x1 red pixel as base64)
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function testGeminiAPI() {
    const apiKey = process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ No API key found. Run with:');
        console.error('   VITE_GEMINI_API_KEY=your_key node src/test-gemini.mjs');
        process.exit(1);
    }

    console.log('✓ API key found');

    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    try {
        console.log('Testing Gemini API connection...');

        // Test 1: Simple text request
        const textResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Say "API working!" in exactly 2 words.' }] }]
            })
        });

        if (!textResponse.ok) {
            const error = await textResponse.json();
            console.error('❌ Text API failed:', error.error?.message || 'Unknown error');
            process.exit(1);
        }

        const textData = await textResponse.json();
        console.log('✓ Text API response:', textData.candidates?.[0]?.content?.parts?.[0]?.text?.trim());

        // Test 2: Vision request with image
        console.log('Testing Vision API...');

        const visionResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: 'What color is this image? Reply with just the color name.' },
                        { inline_data: { mime_type: 'image/png', data: TEST_IMAGE_BASE64 } }
                    ]
                }]
            })
        });

        if (!visionResponse.ok) {
            const error = await visionResponse.json();
            console.error('❌ Vision API failed:', error.error?.message || 'Unknown error');
            process.exit(1);
        }

        const visionData = await visionResponse.json();
        console.log('✓ Vision API response:', visionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim());

        console.log('\n✅ All tests passed! Gemini API is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testGeminiAPI();
