const features = [
  {
    title: "Collaborative coding rooms",
    body: "Create a room, share its Room ID, and everyone who joins edits the same code at the same time. A people list shows who is in the room, and each person's cursor is visible to the others.",
  },
  {
    title: "A real code editor",
    body: "The editor is built on CodeMirror, with syntax highlighting and line numbers, so working together feels like working in your own editor.",
  },
  {
    title: "Run code in the browser",
    body: "Pick a language and run your code without installing anything. JavaScript, Python, Java, C++, C, C#, PHP, Ruby, SQL and Swift are supported, and output and compiler errors appear right beside the editor.",
  },
  {
    title: "Saved code",
    body: "Signed-in users can save, rename and reopen their own snippets, so useful code is still there for the next session.",
  },
];

/** Public product description on the start screen. Copy only; no room or user data. */
export function AboutSection() {
  return (
    <section
      aria-labelledby="about-compile-palace"
      className="cp-atmosphere relative px-6 sm:px-8 py-16 sm:py-20"
    >
      <div className="relative z-10 mx-auto w-full max-w-3xl">
        <h2 id="about-compile-palace" className="text-2xl sm:text-3xl font-bold text-foreground">
          A shared place to write and run code
        </h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Compile Palace is a real-time collaborative code editor for pair programming, teaching, interviews and
          quick experiments. Changes sync live between everyone in a room, and a built-in runner executes the
          code for you.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title}>
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Built with React and TypeScript. Live collaboration runs over Socket.IO, accounts and saved code use
          Supabase, and code runs through Judge0 with JDoodle as a fallback.
        </p>
      </div>
    </section>
  );
}
