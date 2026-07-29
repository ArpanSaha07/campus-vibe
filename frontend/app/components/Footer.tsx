import Link from "next/link";
import Button from "@/app/components/ui/Button";

const linkClasses = "text-mist-200/70 hover:text-white transition-colors";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="z-0 bg-ink-900 text-sm pt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-8">
        {/* Top CTA */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/10 pb-8 mb-8">
          <h3 className="font-display text-xl font-bold text-white text-center sm:text-left">
            Your club belongs on CampusVibe.
          </h3>
          <Button href="/create-club" variant="secondary">
            Start a club page
          </Button>
        </div>

        {/* Links Section */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
          <div>
            <h4 className="ticket-label text-lavender-300 mb-3">Your account</h4>
            <ul className="space-y-2">
              <li><Link href="/login" className={linkClasses}>Sign up</Link></li>
              <li><Link href="/login" className={linkClasses}>Log in</Link></li>
              <li><Link href="/profile" className={linkClasses}>Profile</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="ticket-label text-lavender-300 mb-3">Discover</h4>
            <ul className="space-y-2">
              <li><Link href="/events" className={linkClasses}>Events</Link></li>
              <li><Link href="/clubs" className={linkClasses}>Clubs</Link></li>
              <li><Link href="/my-events" className={linkClasses}>My events</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="ticket-label text-lavender-300 mb-3">CampusVibe</h4>
            <ul className="space-y-2">
              <li><a href="#" className={linkClasses}>About</a></li>
              <li><a href="#" className={linkClasses}>Help</a></li>
            </ul>
          </div>
        </div>

        {/* Copyright Section */}
        <div className="flex flex-col sm:flex-row sm:items-center mt-10 space-y-3 sm:space-y-0 sm:space-x-6 text-mist-200/70">
          <span className="text-white">© {currentYear} CampusVibe</span>
          <a href="#" className={linkClasses}>Terms of service</a>
          <a href="#" className={linkClasses}>Privacy policy</a>
          <a href="#" className={linkClasses}>Cookie policy</a>
        </div>
      </div>
    </footer>
  );
}
