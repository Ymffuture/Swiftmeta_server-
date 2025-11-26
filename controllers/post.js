import Post from '../models/Post.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

cloudinary.config({ cloud_name: 'yourcloud', api_key: 'yourkey', api_secret: 'yoursecret' });

export const createPost = [upload.single('image'), async (req, res) => {
  const { content } = req.body;
  let imageUrl = '';
  if (req.file) {
    const result = await cloudinary.uploader.upload(req.file.path);
    imageUrl = result.secure_url;
  }
  const post = new Post({ user: req.userId, content, image: imageUrl });
  await post.save();
  res.status(201).json(post);
}];

export const getPosts = async (req, res) => {
  const posts = await Post.find().populate('user', 'username').populate('comments.user', 'username');
  res.json(posts);
};

export const editPost = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const post = await Post.findById(id);
  if (post.user.toString() !== req.userId) return res.status(403).json({ message: 'Unauthorized' });
  post.content = content;
  await post.save();
  res.json(post);
};

export const deletePost = async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (post.user.toString() !== req.userId) return res.status(403).json({ message: 'Unauthorized' });
  await post.remove();
  res.json({ message: 'Post deleted' });
};

export const likePost = async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post.likes.includes(req.userId)) {
    post.likes.push(req.userId);
    await post.save();
  }
  res.json(post);
};

export const commentPost = async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const post = await Post.findById(id);
  post.comments.push({ user: req.userId, text });
  await post.save();
  res.json(post);
};
