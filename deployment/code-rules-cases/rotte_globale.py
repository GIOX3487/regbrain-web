from fastapi import FastAPI, Depends
from .auth import get_current_user
app = FastAPI(dependencies=[Depends(get_current_user)])

@app.post("/items") #! -
def create_item(item: dict):
    return item

@app.get("/items/{item_id}") #! -
def read_item(item_id: int):
    return {"id": item_id}
