import React, { useEffect, useRef, useState } from 'react';

export default function TweetEmbed({ html, url }) {
    const containerRef = useRef(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isFailed, setIsFailed] = useState(false);

    useEffect(() => {
        if (!url && !html) {
            setIsFailed(true);
            return;
        }

        const extractTweetId = (str) => {
            try {
                const match = new URL(str).pathname.match(/\/status\/(\d+)/i);
                return match ? match[1] : null;
            } catch {
                return null;
            }
        };

        const tweetId = extractTweetId(url);

        if (containerRef.current) {
            containerRef.current.innerHTML = html || '';
            setHasLoaded(false);
            setIsFailed(false);
        }

        if (!document.getElementById('twitter-wjs')) {
            const script = document.createElement('script');
            script.id = 'twitter-wjs';
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.charset = 'utf-8';
            document.body.appendChild(script);
        }

        let retries = 0;
        const initWidget = () => {
            if (window.twttr && window.twttr.widgets) {
                if (html) {
                    window.twttr.widgets.load(containerRef.current)
                        .then(() => setHasLoaded(true))
                        .catch(() => tryCreateFallback(tweetId));
                } else if (tweetId) {
                    tryCreateFallback(tweetId);
                } else {
                    setIsFailed(true);
                }
            } else if (retries < 15) {
                retries++;
                setTimeout(initWidget, 200);
            } else {
                setIsFailed(true);
            }
        };

        const tryCreateFallback = (id) => {
            if (!id || !containerRef.current) {
                setIsFailed(true);
                return;
            }
            containerRef.current.innerHTML = ''; // clear failed html
            window.twttr.widgets.createTweet(id, containerRef.current, { theme: 'light' })
                .then((el) => {
                    if (el) setHasLoaded(true);
                    else setIsFailed(true);
                })
                .catch(() => setIsFailed(true));
        };

        initWidget();
    }, [html, url]);

    if ((!html && !url) || isFailed) {
        return (
            <div className="flex items-center justify-center p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-500 text-sm w-full">
                <p>Failed to load Tweet. <a href={url} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">View on X</a></p>
            </div>
        );
    }

    return (
        <div className="relative w-full overflow-hidden flex items-center justify-center min-h-[150px]">
            <div ref={containerRef} className="w-full flex justify-center tweet-embed-container" />

            {hasLoaded && (
                <div className="absolute inset-0 z-10 pointer-events-none" aria-hidden="true" />
            )}
        </div>
    );
}
