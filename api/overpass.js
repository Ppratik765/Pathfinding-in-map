export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { query } = req.body;

        // Make a clean, server-side request to Overpass
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                // Overpass requires a custom User-Agent for backend requests!
                'User-Agent': 'WayFinder-Student-Project/1.0 (https://wayfinder-algorithms.vercel.app)'
            },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Overpass returned ${response.status}` });
        }

        // Send the data back to your frontend
        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ error: 'Backend fetch failed' });
    }
}