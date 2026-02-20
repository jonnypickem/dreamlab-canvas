import React, { useEffect, useRef, useState } from 'react';

export default function TweetEmbed({ html, url }) {
    const containerRef = useRef(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isFailed, setIsFailed] = useState(false);

    useEffect(() => {
        if (!html) {
            setIsFailed(true);
            return;
        }

        // 1. Inject the HTML into the container
        if (containerRef.current) {
            // Reset the container when html changes
            containerRef.current.innerHTML = html;
            setHasLoaded(false);
            setIsFailed(false);
        }

        // 2. Load the widgets.js script if it hasn't been added yet
        if (!document.getElementById('twitter-wjs')) {
            const script = document.createElement('script');
            script.id = 'twitter-wjs';
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.charset = 'utf-8';
            document.body.appendChild(script);
        }

        // 3. Trigger Twitter widget script styling & parsing
        let retries = 0;
        const loadWidget = () => {
            if (window.twttr && window.twttr.widgets) {
                window.twttr.widgets.load(containerRef.current)
                    .then(() => {
                        setHasLoaded(true);
                    })
                    .catch((err) => {
                        console.error("Error loading Twitter widget:", err);
                        setIsFailed(true);
                    });
            } else if (retries < 10) {
                // Wait for the script to finish loading if it is newly injected
                retries++;
                setTimeout(loadWidget, 200);
            } else {
                setIsFailed(true);
            }
        };

        loadWidget();
    }, [html]);

    if (!html || isFailed) {
        return (
            <div className="flex items-center justify-center p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-500 text-sm">
                <p>Failed to load Tweet. <a href={url} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">View on X</a></p>
            </div>
        );
    }

    return (
        <div className="relative w-full overflow-hidden flex items-center justify-center">
            {/* The actual tweet container. Twitter's widgets.js will morph the <blockquote> inside here into an iframe */}
            <div ref={containerRef} className="w-full flex justify-center tweet-embed-container" />

            {/* Custom Interactive Surface Overlay Slot. This is where you would place specific click interactions or 'destruction' FX */}
            {hasLoaded && (
                <div
                    className="absolute inset-0 z-10 pointer-events-none"
                    aria-hidden="true"
                />
            )}
        </div>
    );
}
