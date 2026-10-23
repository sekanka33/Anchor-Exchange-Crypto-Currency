import { useState } from "react";
import PageHeader from "../Components/PageHeader";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";

const CATEGORIES = ["View All", "Learn & Earn", "Metaverse", "Energy", "NFT", "Gaming", "Music"];

const POSTS = [
  { id: 1, category: "Learn & Earn", title: "What is Bitcoin and how does it work?", author: "Anchor Team", date: "2026-01-12", videoUrl: "https://youtu.be/-1ErJsH73Lk?si=_HuQ866f4amz1uk2" },
  { id: 2, category: "Learn & Earn", title: "A beginner's guide to buying your first crypto", author: "Anchor Team", date: "2026-01-20", videoUrl: "https://youtu.be/--GRcD_DY0Y?si=cykB0Md9COT0u7lV" },
  { id: 3, category: "NFT", title: "Understanding NFTs: ownership on the blockchain", author: "Anchor Team", date: "2026-02-02", videoUrl: "https://youtu.be/eZGDvWyreOY?si=RXoitXqLhkZPPknU" },
  { id: 4, category: "Metaverse", title: "How the metaverse is reshaping digital assets", author: "Anchor Team", date: "2026-02-14", videoUrl: "https://youtu.be/EBwf4mmy5q8?si=sATHdpbTfRWTOXPu" },
  { id: 5, category: "Learn & Earn", title: "Spot vs. futures trading: what's the difference?", author: "Anchor Team", date: "2026-03-01", videoUrl: "https://youtu.be/Gb7a65Pr0Og?si=eVvMFH8vcIVdkm7F" },
  { id: 6, category: "Gaming", title: "Play-to-earn games and in-game economies", author: "Anchor Team", date: "2026-03-09", videoUrl: "https://youtu.be/6VEzWfADwJE?si=Ap_TBgYdkXq8E-3E" },
  { id: 7, category: "Energy", title: "The energy debate around proof-of-work mining", author: "Anchor Team", date: "2026-03-22", videoUrl: "https://youtu.be/-1ErJsH73Lk?si=_HuQ866f4amz1uk2" },
  { id: 8, category: "Music", title: "Musicians embracing tokenized royalties", author: "Anchor Team", date: "2026-04-03", videoUrl: "https://youtu.be/-1ErJsH73Lk?si=_HuQ866f4amz1uk2" },
  { id: 9, category: "NFT", title: "How to safely store and trade digital collectibles", author: "Anchor Team", date: "2026-04-15", videoUrl: "https://youtu.be/-1ErJsH73Lk?si=_HuQ866f4amz1uk2" },
];

const TAGS = ["Crypto", "Wallet", "Bitcoin", "NFT Marketplace", "Metaverse", "Token", "Arts"];

// Helper function to extract the YouTube ID from youtu.be or watch?v= links and format it for embeds
const getYouTubeEmbedUrl = (url) => {
  if (!url) return "";
  let videoId = "";
  if (url.includes("youtu.be/")) {
    videoId = url.split("youtu.be/")[1]?.split("?")[0];
  } else if (url.includes("watch?v=")) {
    videoId = url.split("watch?v=")[1]?.split("&")[0];
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
};

const Blog = () => {
  const [category, setCategory] = useState("View All");
  const [search, setSearch] = useState("");

  const visiblePosts = POSTS.filter(
    (post) =>
      (category === "View All" || post.category === category) &&
      post.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Blog" crumbs={[{ label: "Home", to: "/" }, { label: "Blog" }]} />

      <div className="flex flex-col lg:flex-row gap-10 px-4 md:px-12 lg:px-20 py-10">

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 [&>button]:flex-shrink-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  category === cat
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-hero-dark"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {visiblePosts.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400 py-10 text-center">No posts match this filter.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {visiblePosts.map((post) => (
              <article
                key={post.id}
                className="bg-white dark:bg-hero-dark border border-gray-200 dark:border-transparent rounded-2xl overflow-hidden shadow-sm flex flex-col"
              >
                <div className="aspect-video bg-slate-200 dark:bg-crypto-color overflow-hidden">
                  {post.videoUrl ? (
                    <iframe
                      className="w-full h-full"
                      src={getYouTubeEmbedUrl(post.videoUrl)}
                      title={post.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      No Video Available
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col gap-2 flex-1">
                  <span className="inline-block w-fit bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase px-2 py-1 rounded-full">
                    {post.category}
                  </span>
                  <h2 className="font-bold text-slate-900 dark:text-white leading-snug">{post.title}</h2>
                  <div className="mt-auto flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 pt-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      {post.author}
                    </span>
                    <span>{post.date}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="w-full lg:w-70 shrink-0 flex flex-col gap-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search blog posts"
            placeholder="Search posts"
            className="h-11 w-full rounded-full px-4 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-3">Categories</h3>
            <ul className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
              {CATEGORIES.filter((c) => c !== "View All").map((cat) => (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => setCategory(cat)}
                    className="hover:text-slate-900 dark:hover:text-white"
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-3">Popular tags</h3>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-xs bg-slate-100 dark:bg-hero-dark text-gray-600 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CreateAnAccoutSection />
    </div>
  );
};

export default Blog;