// Starting content for the site. Once the owner saves anything in /admin,
// the saved version (stored in Netlify Blobs) is used instead of this file.

export const DEFAULT_CONTENT = {
  version: 1,
  business: {
    name: "GO Brothers Construction",
    ownerName: "Art Garner",
    tagline: "Remodels, build-outs, concrete & general contracting",
    headline: "We finish.",
    services:
      "Remodels, renovations, commercial build\u2011outs, concrete and general contracting across Dallas–Fort Worth. Led by Art and Logan Garner.",
    street: "3201 W Pipeline Rd",
    city: "Euless, TX",
    zip: "76040",
    serviceArea: "Dallas–Fort Worth and North Texas",
    phone: "(972) 832-2637",
    email: "art@gobroswork.com",
    instagram: "https://instagram.com/gobrothersconstruction",
    facebook: "",
    license: "",
  },
  announcement: {
    show: false,
    text: "",
  },
  trust: ["Residential & commercial", "Free estimates", "Serving DFW & North Texas"],
  menu: {
    heading: "What we build",
    items: [
      {
        title: "Remodels & Renovations",
        body:
          "Kitchens, bathrooms, and whole-home renovations, plus custom residential finish work. The final 10% is what you notice every day, so we take it seriously.",
        note: "",
      },
      {
        title: "Commercial Build-Outs",
        body: "Retail and commercial build-outs from bare space to opening day, managed with clear scheduling and on-site oversight.",
        note: "",
      },
      {
        title: "Concrete & Structural",
        body: "Concrete work, pier installation, and structural leveling that protect the bones of your property for decades, not seasons.",
        note: "",
      },
      {
        title: "General Contracting",
        body:
          "One team responsible for the whole project.\n\n- Estimating and budget analysis before work begins\n- Scheduling and site oversight\n- Coordinating every trade through to the final walkthrough",
        note: "",
      },
    ],
  },
  steps: {
    heading: "How we work",
    items: [
      "Call or email Art to talk through your project",
      "We estimate, budget, and catch problems before work begins",
      "Our crew builds with clear scheduling and regular updates",
      "We finish, walk it with you, and stand behind the work",
    ],
  },
  gallery: {
    heading: "Recent projects",
    intro: "Tap any photo to see it up close.",
    categories: ["Remodels", "Commercial", "Concrete", "Before & After"],
  },
  reviews: {
    heading: "What our clients say",
    items: [],
  },
  about: {
    heading: "About GO Brothers",
    title: "Built on faith, hard work, and trust",
    body:
      "GO Brothers Construction is led by brothers Art and Logan Garner. We take on homes, businesses, projects, and investments across Dallas–Fort Worth, and we're growing into bigger work every year.\n\n" +
      "Construction isn't always perfect. Things go wrong, problems come up, and plans change. But one thing we can promise: **we finish.**\n\n" +
      "We're not building something for a year or two. We're building for the long term, and for relationships that last a lifetime.",
    listTitle: "What we stand on",
    listBody: "",
    list: ["Faith", "Hard work", "Honesty", "Trust", "Relationships that last"],
  },
  policies: {
    heading: "Good to know",
    intro: "",
    items: [],
    outro: "",
  },
  contact: {
    heading: "Let's talk about your project",
    body: "Whether you're still planning or ready to break ground, reach out directly. Art responds personally.",
    checklist: ["Project address", "What you'd like built or remodeled", "Photos or plans, if you have them", "Your ideal timeline"],
  },
};

// No starting photos: the owner adds his own through /admin.
export const DEFAULT_PHOTOS = [];
