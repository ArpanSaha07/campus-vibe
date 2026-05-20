'use client';

import { useState } from 'react';
import {
  Facebook,
  Twitter,
  Linkedin,
  Mail,
  Link2,
  X,
} from 'lucide-react';

// TODO: resolve deprecated icons, add event title and url as props, make the share text more descriptive, add tooltips to the icons, improve styling and responsiveness, handle edge cases for sharing (e.g., if window is undefined)
//eventUrl = typeof window !== 'undefined' ? window.location.href : '',

export default function EventFollowButton({eventId}: {eventId: string}) {
  const [isShareOpen, setIsShareOpen] = useState(false);

  const handleShareClick = () => {
    setIsShareOpen(true);
  };

  const handleCloseShare = () => {
    setIsShareOpen(false);
  };

  // const shareText = `${eventTitle} ${eventUrl}`;
  const eventTitle = ""

  const handleShare = (platform: string) => {
    let url = '';
    const encodedText = "" // encodeURIComponent(shareText);
    const encodedUrl = "" // encodeURIComponent(eventUrl);

    switch (platform) {
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodedText}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'email':
        url = `mailto:?subject=${encodeURIComponent(eventTitle)}&body=${encodedText}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(eventId);
        alert('Link copied to clipboard!');
        return;
    }

    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  return (
    <>
      <span data-spec="icon-button">
        <button
          onClick={handleShareClick}
          aria-label="Share"
          className="p-2 rounded-full bg-white cursor-pointer"
        >
          <svg
            fill="#444444"
            width="20px"
            height="20px"
            viewBox="0 0 24 24"
          >
            <path
              d="M18 16v2H6v-2H4v4h16v-4z"
            ></path>
            <path
              d="M12 4L7 9l1.4 1.4L11 7.8V16h2V7.8l2.6 2.6L17 9l-5-5z"
            ></path>
          </svg>
        </button>
      </span>

      {isShareOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
          {/* Background Overlay */}
          <div
            className="fixed inset-0 bg-white/10 backdrop-blur-md transition-opacity "
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-sm">
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold">
                  Share with friends
                </h2>
                <button
                  onClick={handleCloseShare}
                  className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Social Icons */}
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
                  <button
                    onClick={() => handleShare('facebook')}
                    className="p-2 sm:p-3 rounded-full hover:bg-gray-100 transition-colors"
                    title="Share on Facebook"
                  >
                    <Facebook size={24} className="text-blue-600" />
                  </button>

                  <button
                    onClick={() => handleShare('twitter')}
                    className="p-2 sm:p-3 rounded-full hover:bg-gray-100 transition-colors"
                    title="Share on Twitter"
                  >
                    <Twitter size={24} className="text-blue-400" />
                  </button>

                  <button
                    onClick={() => handleShare('linkedin')}
                    className="p-2 sm:p-3 rounded-full hover:bg-gray-100 transition-colors"
                    title="Share on LinkedIn"
                  >
                    <Linkedin size={24} className="text-blue-700" />
                  </button>

                  <button
                    onClick={() => handleShare('email')}
                    className="p-2 sm:p-3 rounded-full hover:bg-gray-100 transition-colors"
                    title="Share via Email"
                  >
                    <Mail size={24} className="text-gray-600" />
                  </button>

                  <button
                    onClick={() => handleShare('copy')}
                    className="p-2 sm:p-3 rounded-full hover:bg-gray-100 transition-colors"
                    title="Copy link"
                  >
                    <Link2 size={24} className="text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
