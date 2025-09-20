export default function Footer() {
  return (
    <footer className="z-0 bg-neutral-800 text-gray-400 text-sm pt-4">
      <div className="max-w-7xl mx-auto px-6 pt-3 pb-8">
        {/* Top CTA */}
        <div className="flex flex-col sm:flex-row justify-center sm:justify-start items-center border-b border-gray-600 pb-6 mb-6 text-white space-x-6 py-auto font-bold">
          <h3 className="text-lg mb-4 sm:mb-0 ">
            Create your own CampusVibe group.
          </h3>
          <button className="border-2 border-white px-4 py-2 rounded hover:bg-white hover:text-black transition">
            Get Started
          </button>
        </div>

        {/* Links Section */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
          <div>
            <h4 className="font-semibold mb-3 text-white">Your Account</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-white">Sign up</a></li>
              <li><a href="#" className="hover:text-white">Log in</a></li>
              <li><a href="#" className="hover:text-white">Help</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-white">Discover</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-white">Groups</a></li>
              <li><a href="#" className="hover:text-white">Calendar</a></li>
              <li><a href="#" className="hover:text-white">Topics</a></li>
              <li><a href="#" className="hover:text-white">Online Events</a></li>
              <li><a href="#" className="hover:text-white">Make Friends</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-white">CampusVibe</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-white">About</a></li>
              <li><a href="#" className="hover:text-white">CampusVibe Pro</a></li>
            </ul>
          </div>
        </div>

        {/* Copyright Section */}
        <div className="flex flex-col sm:flex-row sm:items-center mt-10 space-y-4 text-sm sm:space-y-0 sm:space-x-6">
          
          <span className="text-white">© 2025 CampusVibe</span>
          <a href="#" data-event-label="Terms of Service" className="hover:text-white">Terms of Service</a>
          <a href="#" data-event-label="Privacy Policy" className="hover:text-white">Privacy Policy</a>
          <a href="#" data-event-label="Cookie Settings" className="hover:text-white">Cookie Settings</a>
          <a href="#" data-event-label="Cookie Policy" className="hover:text-white">Cookie Policy</a>
          <a href="#" data-event-label="License Attribution" className="hover:text-white">License Attribution</a>
          <a href="#" data-event-label="Help" className="hover:text-white">Help</a>
        </div>
      </div>
    </footer>
  );
}
