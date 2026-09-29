/**
 * Shared step-wizard header (circle + connecting line per step) reused across
 * every multi-step money-flow page (Buy/Sell Crypto, Deposit x2, Withdraw x2),
 * matching the Figma "Rocket" stepper: checkmark once done, filled ring on
 * the current step, hollow circle for future steps.
 */
const StepIndicator = ({ steps, currentStep }) => {
  return (
    <ol className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-semibold mb-8 justify-center flex-wrap">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isDone = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <li key={label} className="flex items-center gap-2 sm:gap-4">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`w-6 sm:w-16 h-0.5 ${
                  isDone || isCurrent
                    ? "bg-green-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
            )}

            <div
              className={`flex items-center gap-2 ${
                isDone || isCurrent
                  ? "text-slate-900 dark:text-white"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] leading-none ${
                  isDone
                    ? "border-green-500 bg-green-500 text-white"
                    : isCurrent
                    ? "border-green-500 bg-green-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {isDone ? "✓" : null}
              </span>

              <span>{label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default StepIndicator;
