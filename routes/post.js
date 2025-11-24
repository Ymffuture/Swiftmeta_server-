const express = require('express');
const router = express.Router();
const postsCtrl = require('../controllers/posts');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, postsCtrl.createPost);
router.get('/', postsCtrl.getPosts);
router.put('/:id', authMiddleware, postsCtrl.editPost);
router.delete('/:id', authMiddleware, postsCtrl.deletePost);
router.post('/:id/like', authMiddleware, postsCtrl.likePost);
router.post('/:id/comment', authMiddleware, postsCtrl.commentPost);

module.exports = router;
