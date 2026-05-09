export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}
