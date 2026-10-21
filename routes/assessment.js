'use strict';
const router = require('express').Router();
const { auth, assessmentAccess, ok } = require('../middleware');

// Platzhalter: die Inhalte des Assessments folgen.
router.get('/', auth, assessmentAccess, (req,res) => ok(res, { items: [] }));

module.exports = router;
