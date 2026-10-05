from flask import Flask, request
from flask_login import login_required
app = Flask(__name__)

@app.route("/admin/users", methods=["POST"]) #! SEC-16
def create_user():
    return save(request.json)

@login_required
@app.route("/admin/settings", methods=["POST"]) #! -
def settings():
    return save(request.json)

@app.route("/login", methods=["POST"]) #! -
def login():
    return issue_token(request.json)
