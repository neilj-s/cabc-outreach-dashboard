import express from 'express';

const router = express.Router();

const BIBLE_VERSES = [
  {
    text: "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters...",
    reference: "Colossians 3:23",
    theme: "Dedication & Excellence"
  },
  {
    text: "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up...",
    reference: "Galatians 6:9",
    theme: "Perseverance & Service"
  },
  {
    text: "Each of you should use whatever gift you have received to serve others, as faithful stewards of God’s grace in its various forms...",
    reference: "1 Peter 4:10",
    theme: "Stewardship & Team"
  },
  {
    text: "For God is not unjust. He will not forget your work and the love you have shown him as you have helped his people and continue to help them...",
    reference: "Hebrews 6:10",
    theme: "Encouragement"
  },
  {
    text: "Commit to the Lord whatever you do, and he will establish your plans...",
    reference: "Proverbs 16:3",
    theme: "Planning & Vision"
  },
  {
    text: "Write the vision and make it plain on tablets, that he may run who reads it...",
    reference: "Habakkuk 2:2",
    theme: "Vision & Action"
  },
  {
    text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God...",
    reference: "Philippians 4:6",
    theme: "Prayer & Peace"
  },
  {
    text: "Do everything in love...",
    reference: "1 Corinthians 16:14",
    theme: "Love & Fellowship"
  }
];

router.get('/', (req, res) => {
  res.json(BIBLE_VERSES);
});

export default router;
