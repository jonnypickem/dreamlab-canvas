import React, { useState } from 'react';
import { FeatherExternalLink } from "@subframe/core";

export default function TweetEmbed({ authorName, authorHandle, authorUrl, authorImage, tweetText, url, mediaUrl, isEnlarged = false }) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);

    const handle = authorHandle || (() => {
        try {
            if (!authorUrl) return '';
            const p = new URL(authorUrl).pathname;
            const h = p.split('/').filter(Boolean)[0];
            return h ? `@${h}` : '';
        } catch {
            return '';
        }
    })();

    return (
        <div className="w-full flex flex-col bg-white rounded-lg overflow-hidden border border-neutral-border shadow-sm transition-all font-sans text-left">
            {/* Header */}
            <div className="p-4 sm:p-5 pb-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 overflow-hidden border border-neutral-border">
                        {authorImage ? (
                            <img src={authorImage} alt={authorName || 'Avatar'} className="w-full h-full object-cover block" />
                        ) : (
                            <span className="text-subtext-color font-body-bold text-sm">
                                {(authorName || 'X').charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-body-bold text-neutral-900 truncate">
                            {authorName || 'Post'}
                        </span>
                        {handle && (
                            <span className="font-caption text-subtext-color truncate">
                                {handle}
                            </span>
                        )}
                    </div>
                </div>
                {/* X Logo */}
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-subtext-color hover:text-default-font transition-colors">
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                </a>
            </div>

            {/* Text Content */}
            {tweetText && (
                <div className="px-4 sm:px-5 pb-4">
                    <p className={`font-body text-neutral-900 leading-relaxed whitespace-pre-line ${!isEnlarged ? 'line-clamp-6' : ''}`}>
                        {tweetText}
                    </p>
                </div>
            )}

            {/* Media */}
            {mediaUrl && !imgError && (
                <div className="w-full relative bg-neutral-50 border-y border-neutral-border">
                    {!imgLoaded && (
                        <div className="w-full aspect-video bg-neutral-100 animate-pulse" />
                    )}
                    <img
                        src={mediaUrl}
                        alt="Tweet media"
                        className={`w-full h-auto max-h-[400px] object-cover block ${imgLoaded ? '' : 'hidden'}`}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgError(true)}
                    />
                </div>
            )}

            {/* Footer / Call to action */}
            {isEnlarged && (
                <div className="p-4 bg-neutral-50 border-t border-neutral-border flex justify-center">
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 rounded-md border border-neutral-border bg-white flex items-center justify-center gap-2 font-body-bold text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors shadow-sm"
                    >
                        <FeatherExternalLink className="w-4 h-4" />
                        Read more on X
                    </a>
                </div>
            )}
        </div>
    );
}
