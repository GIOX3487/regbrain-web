import pickle, yaml, jwt
data = pickle.loads(request.data)  #! SEC-12
doc = yaml.load(f)  #! SEC-12
doc2 = yaml.load(f, Loader=yaml.SafeLoader)  #! -
doc3 = yaml.safe_load(f)  #! -
claims = jwt.decode(token, options={"verify_signature": False})  #! SEC-11
claims_ok = jwt.decode(token, key, algorithms=["HS256"])  #! -
with open(os.path.join(BASE, request.args.get("f"))) as fh:  #! SEC-13
    pass
with open(os.path.join(BASE, secure_filename(request.args.get("f")))) as fh:  #! -
    pass
send_from_directory(UPLOADS, request.args["name"])  #! SEC-13
ctx = ssl.SSLContext(ssl.PROTOCOL_TLSv1)  #! SEC-14
ctx2 = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)  #! -
# La riga sotto parla di emozioni in un modello di IA, non di una libreria CSS.
mood = detectEmotion(frame)  #! AI-03
resp = rekognition.detect_faces(Image=img, Attributes=["ALL"])  #! -
ranked = model.predict(applicant_features)  #! AI-04
scored_chunks = rank_candidates(chunk_scores)  #! -
shortlist = rank_candidates(model.predict_proba(applicants))  #! AI-04
loan_decision = classifier.predict(credit_features)  #! AI-04
exam_score = compute_test_score(answers)  #! -
leaderboard = sorted(players, key=lambda p: p.score)  #! -
