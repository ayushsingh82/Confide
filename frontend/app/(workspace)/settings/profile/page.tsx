export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Manage your identity and email settings.
        </p>
      </div>

      {/* Avatar + name */}
      <section className="border border-neutral-900 bg-black p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 text-2xl font-semibold text-black">
              AS
            </div>
            <button
              type="button"
              className="border border-neutral-800 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900"
            >
              Upload
            </button>
            <p className="text-[0.65rem] text-neutral-600">Max 5 MB</p>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-500">
                Name
              </label>
              <input
                defaultValue="Ayush Singh"
                className="mt-1 w-full border border-neutral-800 bg-black px-3 py-2 text-sm text-white focus:border-neutral-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-500">
                Display name
              </label>
              <input
                defaultValue="Ayush"
                className="mt-1 w-full border border-neutral-800 bg-black px-3 py-2 text-sm text-white focus:border-neutral-600 focus:outline-none"
              />
            </div>
            <div className="pt-2">
              <button
                type="button"
                className="bg-white px-4 py-2 text-xs font-medium text-black transition hover:bg-neutral-200"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Linked emails */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          Linked emails
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Email addresses linked to your account.
        </p>

        <div className="mt-4 border border-neutral-900">
          <div className="flex items-center gap-3 border-b border-neutral-900 bg-black px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs">
              ✉
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">ayushsinghmi711@gmail.com</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-widest">
                <span className="bg-emerald-900/40 px-1.5 py-0.5 text-emerald-300">
                  Primary
                </span>
                <span className="bg-neutral-900 px-1.5 py-0.5 text-neutral-400">
                  OAuth
                </span>
                <span className="bg-neutral-900 px-1.5 py-0.5 text-neutral-400">
                  Verified
                </span>
              </div>
            </div>
          </div>
          <p className="bg-black px-4 py-3 text-xs text-neutral-500">
            Your email is managed through your authentication provider (e.g., GitHub).
            To change your email, update it in your provider&apos;s settings and sign in again.
          </p>
        </div>
      </section>

      {/* Danger zone */}
      <section className="border border-red-900/40 bg-red-950/10 p-6 sm:p-8">
        <h2 className="text-sm font-medium uppercase tracking-widest text-red-300">
          Danger zone
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Delete your account</p>
            <p className="mt-1 text-xs text-neutral-500">
              Permanently delete your account and all associated data.
            </p>
          </div>
          <button
            type="button"
            className="border border-red-700/60 bg-red-900/20 px-4 py-2 text-xs font-medium text-red-200 transition hover:bg-red-900/40"
          >
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
