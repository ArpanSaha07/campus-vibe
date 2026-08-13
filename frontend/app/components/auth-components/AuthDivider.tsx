// The "or" rule that separates Google from the email path on every auth view.
export default function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-grow bg-mist-200" />
      <span className="text-sm text-ink-600">or</span>
      <span className="h-px flex-grow bg-mist-200" />
    </div>
  );
}
