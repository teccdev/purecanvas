import { useEffect } from "react";

/**
 * Short, plain-language privacy policy. Linked from the footer at /privacy.
 * Keep claims literal: analytics are first-party, cookie-free, and never use
 * IP addresses or cross-site identifiers.
 */
export function PrivacyPolicy() {
    useEffect(() => {
        const previous = document.title;
        document.title = "Privacy Policy — PureCanvas";

        // Match the editor's saved theme on this standalone page.
        const root = document.documentElement;
        let stored: string | null = null;
        try {
            stored = localStorage.getItem("purecanvas-theme");
        } catch {
            /* storage unavailable */
        }
        const theme = stored === "light" ? "light" : "dark";
        root.classList.toggle("dark", theme === "dark");
        root.style.colorScheme = theme;

        return () => {
            document.title = previous;
        };
    }, []);

    return (
        <main className="min-h-screen bg-background text-foreground">
            <div className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
                <a
                    href="/"
                    className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                    ← Back to PureCanvas
                </a>
                <h1 className="mt-8 text-3xl font-semibold tracking-tight">
                    Privacy Policy
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Last updated November 2026
                </p>

                <div className="mt-8 space-y-5 text-[15px] leading-7 text-muted-foreground">
                    <p>
                        PureCanvas is local-first. The projects and images you
                        create or add stay in your browser’s storage and are
                        never uploaded to us.
                    </p>
                    <p>
                        We collect anonymous usage data to understand how the
                        app is used: the pages you visit, the site or campaign
                        that referred you, your approximate country, browser and
                        device type, and a random ID kept in your browser to
                        count unique visitors. We also record whether a visit
                        lasted more than a few seconds or involved interaction.
                    </p>
                    <p>
                        Our analytics use no cookies, do not store your IP
                        address, and are not used for advertising or cross-site
                        tracking. If your browser sends Do Not Track or Global
                        Privacy Control, analytics are skipped.
                    </p>
                    <p>
                        Stock image searches are sent through our server to
                        Pixabay; Pixabay’s own privacy policy applies to those
                        requests. Aggregated analytics are kept for up to 13
                        months.
                    </p>
                    <p>
                        Questions?{" "}
                        <a
                            className="underline underline-offset-4 hover:text-foreground"
                            href="mailto:teccin+purecanvas@proton.me"
                        >
                            teccin+purecanvas@proton.me
                        </a>
                    </p>
                </div>
            </div>
        </main>
    );
}
