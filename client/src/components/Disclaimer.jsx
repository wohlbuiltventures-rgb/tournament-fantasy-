export default function Disclaimer({ className = '' }) {
  return (
    <p className={`text-xs text-gray-600 leading-relaxed ${className}`}>
      TourneyRun is a skill-based fantasy game. Payments powered by Stripe.
      Not available in WA, ID, MT, NV, LA.
    </p>
  );
}
