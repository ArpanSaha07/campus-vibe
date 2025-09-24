import Image from "next/image";

export default function OAuthButtons() {
  return (
    <div>
      <div className="flex items-center my-4">
        <hr className="flex-grow border-t border-gray-300" />
        <span className="px-2 text-sm text-gray-500">Or sign in with</span>
        <hr className="flex-grow border-t border-gray-300" />
      </div>
      <div className="flex justify-center gap-4">
        <button className="p-2 border rounded">
          <Image src="/google.svg" alt="Google" className="h-6 w-6" />
        </button>
        {/* Add more social media as login options as needed */}
      </div>
    </div>
  );
}
