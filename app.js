const fs = require("fs");
const winston = require("winston");
const util = require("util");
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const path = require("path");
const pug = require("pug");
const cookieParser = require("cookie-parser");
const { json } = require("express");

app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());
app.use(json());
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

let playerNamesList = JSON.parse(
  fs.readFileSync(path.join(__dirname, "/static/names.json"), "utf8")
);
let rooms = {};
let playersRoomId = {};
const port = process.env.PORT || 80;

app.get("/", function (req, res) {
  return res.redirect("/xo");
});

app.get("/xo/:tagId?", function (req, res) {
  let linkRoomId = req.params.tagId;
  if (linkRoomId && !rooms[linkRoomId])
    //wrong room id
    return res.status(404).redirect("/xo");
  return res
    .status(200)
    .sendFile(path.join(__dirname + "/public/views/index.html"));
});
app.post("/xo/:tagId?", function (req, res) {
  //if a tag is available it is valid tag
  console.log(req.body);
  let cookieRoomId = req.body.cookie.roomId;
  let linkRoomId = req.body.linkRoomId;
  let opponentName = "";
  let oldOpponentName = "";
  // if (!linkRoomId && !rooms[cookieRoomId]) //no link and wrong(or no) cookie -> new game
  if (!linkRoomId && rooms[cookieRoomId])
    //no link and a correct cookie -> join the room Id in cookie
    return res.send(JSON.stringify({ isNewGame: false }));
  if (linkRoomId && !rooms[cookieRoomId]) {
    // correct link and a wrong(or no) cookie -> delete coookie and join the room in link
    rooms[linkRoomId].player1.id == linkRoomId
      ? (opponentName = rooms[linkRoomId].player1.name)
      : (opponentName = rooms[linkRoomId].player2.name);
    return res.send(
      JSON.stringify({
        isNewGame: true,
        joinRoomId: linkRoomId,
        opponentName: opponentName,
        msg: `Joining ${opponentName} ...`,
      })
    );
  }
  if (linkRoomId && rooms[cookieRoomId] && cookieRoomId != linkRoomId) {
    //correct link and a correct differnt cookie -> ask to join the room Id in link or stay in the current game
    opponentName = rooms[linkRoomId].player1.name;

    rooms[cookieRoomId].player1.id == req.body.cookie.playerId
      ? (oldOpponentName = rooms[cookieRoomId].player2.name)
      : (oldOpponentName = rooms[cookieRoomId].player1.name);

    return res.send(
      JSON.stringify({
        isNewGame: false,
        isSwitchGame: true,
        joinRoomId: linkRoomId,
        currentRoomId: cookieRoomId,
        opponentName: opponentName,
        oldOpponentName: oldOpponentName,
        msg: `leaving ${oldOpponentName} and join ${opponentName} ?`,
      })
    );
  }

  if (linkRoomId && rooms[cookieRoomId] && cookieRoomId == linkRoomId)
    //correct link and a correct same cookie -> continue the game
    return res.send(
      JSON.stringify({ isNewGame: false, joinRoomId: cookieRoomId })
    );

  return res.send(
    JSON.stringify({
      isNewGame: true,
      msg: "Creating a new game",
      isGameModeVisible: true,
    })
  );
});

server.listen(port, function () {});

io.on("connection", (socket) => {
  socket.on("client-update", (packet) => {
    data = JSON.parse(packet);
    socket.join(data.roomId);
    io.to(data.roomId).emit("update", JSON.stringify(rooms[data.roomId]));
  });

  //new game is created or user wants to join a game(have a correct coockie info)
  socket.on("join-room", (packet) => {
    data = JSON.parse(packet);
    let roomId = "";
    const playerId = socket.id;
    //it is a new room
    if (!data.roomId) {
      roomId = playerId;
      rooms[roomId] = {
        currentPlayer: "X",
        player1: {
          id: playerId,
          name: data.playerName,
          alias: "X",
        },
        player2: {
          id: "",
          name: "",
          alias: "O",
        },
        gameTable: createTableArray(),
        createDate: new Date(),
        move: [],
        round: [],
        gameMode: data.gameMode,
      };

      //create a fake player for single player mode :D
      if (rooms[roomId].gameMode == 1) {
        rooms[roomId].player2 = {
          //machine user default id
          id: -1,
          //pick a random name for opponent(machine)
          name: playerNamesList[
            parseInt(Math.random() * playerNamesList.length)
          ],
          alias: "O",
        };
      }
      // console.log(rooms)
      socket.join(roomId);
      playersRoomId[playerId] = roomId;
      let result = rooms[roomId].player1;
      result.roomId = roomId;
      socket.emit("player-update", JSON.stringify(result)); // create and send new room link
    }
    //user wants to join a correct and available game
    else {
      if (rooms[data.roomId]) {
        roomId = data.roomId;
        rooms[roomId].player2 = {
          id: playerId,
          name: data.playerName,
          alias: "O",
        };
        socket.join(roomId);
        playersRoomId[playerId] = roomId;
        let result = rooms[roomId].player2;
        result.roomId = roomId;
        socket.emit("player-update", JSON.stringify(result)); // create and send new room link
        logger.log({
          level: "info",
          message: JSON.stringify({
            type: "create",
            room: roomId,
            p1: rooms[roomId].player1,
            p2: rooms[roomId].player2,
          }),
        });
      }
    }
    //update both players status
    io.to(roomId).emit("update", JSON.stringify(rooms[roomId]));
  });
  //whan a player plays a move
  socket.on("moveUpdate", (packet) => {
    const data = JSON.parse(packet);
    const currentPlayer = rooms[data.roomId].currentPlayer;
    const gameTable = rooms[data.roomId].gameTable;
    const masterIndex = data.masterIndex;
    const childIndex = data.childIndex;

    //validate the player turn and a cell played
    if (
      data.playerAlias != currentPlayer ||
      gameTable[masterIndex]["child"][childIndex]["cellValue"].status ==
        "disabled"
    )
      return;

    //play the user action
    playCell(rooms[data.roomId], masterIndex, childIndex, currentPlayer);

    if (rooms[data.roomId].gameMode == 1) playRandom(rooms[data.roomId]);
    //update both player status
    io.to(data.roomId).emit("update", JSON.stringify(rooms[data.roomId]));

    //log the end of game
    if (rooms[data.roomId].isGameEnd) {
      logger.log({
        level: "info",
        message: JSON.stringify({
          type: "end",
          move: rooms[data.roomId].move,
          p1: rooms[data.roomId].player1,
          p2: rooms[data.roomId].player2,
          winner: rooms[data.roomId].winnerAlias,
        }),
      });
    }
  });
  socket.on("rematch", (packet) => {
    const data = JSON.parse(packet);
    delete rooms[data.roomId].lastMove;
    rooms[data.roomId].isGameEnd = false;
    rooms[data.roomId].round.push(rooms[data.roomId].winnerAlias);
    rooms[data.roomId].isPot = false;
    rooms[data.roomId].winnerAlias = "";
    rooms[data.roomId].move = [];
    rooms[data.roomId].gameTable = createTableArray();
    io.to(data.roomId).emit("rematch", JSON.stringify(data.playerId));

    logger.log({
      level: "info",
      message: JSON.stringify({
        type: "rematch",
        p1: rooms[data.roomId].player1,
        p2: rooms[data.roomId].player2,
      }),
    });
  });
  socket.on("exit-room", (roomId) => {
    if (rooms[roomId] == undefined) return;
    const room = rooms[roomId];
    delete playersRoomId[room.player1.id];
    delete playersRoomId[room.player2.id];
    delete rooms[roomId];
    io.to(roomId).emit("room-closed", JSON.stringify(roomId));
    logger.log({
      level: "info",
      message: JSON.stringify({
        type: "closed",
        room: roomId,
        p1: room.player1,
        p2: room.player2,
      }),
    });
  });
});

////////////////////////////////////////////////////////////////////////////////
///////////////////////////////<<functions>>////////////////////////////////////
function createTableArray() {
  let arr = {};
  let counter = 0;
  arr = Array.from({ length: 9 }, () => {
    return {
      master: {},
      child: Array.from({ length: 9 }, () => {
        return {
          cellValue: "", //counter++
          status: "enabled",
        };
      }),
    };
  });
  return arr;
  console.log(util.inspect(arr, false, 6, true));
}
function checkWin(table, masterIndex, playerAlias) {
  const winComb = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  let result = {
    isChildWin: false,
    childWinComb: [],
    isGameEnd: false,
    table: table,
  };
  let filledCellCounter = 0;
  //check for child table for winner
  winComb.forEach((element) => {
    if (
      table[masterIndex]["child"][element[0]]["cellValue"] == playerAlias &&
      table[masterIndex]["child"][element[1]]["cellValue"] == playerAlias &&
      table[masterIndex]["child"][element[2]]["cellValue"] == playerAlias
    )
      return Object.assign(result, { isChildWin: true, childWinComb: element });
  });

  for (let i = 0; i < 9; i++) {
    if (table[masterIndex]["child"][i]["cellValue"]) filledCellCounter++;
  }
  //child cell is NOT filled up and No winner
  if (filledCellCounter != 9 && !result.isChildWin) return result;

  if (filledCellCounter == 9 && !result.isChildWin) {
    //child cell has no winner and filled up
    table[masterIndex]["master"]["winner"] = {
      winnerAlias: "",
      winnerComb: "",
      isPot: true,
    };
  } else {
    //child cell has a winner
    table[masterIndex]["master"]["winner"] = {
      winnerAlias: playerAlias,
      winnerComb: result.childWinComb,
    };
  }
  filledCellCounter = 0;

  //check for main table for winner
  winComb.forEach((element) => {
    if (
      table[element[0]].master.winner != undefined &&
      table[element[1]].master.winner != undefined &&
      table[element[2]].master.winner != undefined
    ) {
      if (
        table[element[0]].master.winner.winnerAlias == playerAlias &&
        table[element[1]].master.winner.winnerAlias == playerAlias &&
        table[element[2]].master.winner.winnerAlias == playerAlias
      )
        return Object.assign(result, {
          isGameEnd: true,
          winnerComb: element,
          table: table,
        });
    }
  });

  //check for a pot end condition in a master table
  for (let i = 0; i < 9; i++) {
    if (
      table[i].master.winner &&
      (table[i].master.winner.winnerAlias || table[i].master.winner.isPot)
    )
      filledCellCounter++;
  }

  //game has no winner and all cells filled up
  if (filledCellCounter == 9) {
    Object.assign(result, {
      isGameEnd: true,
      isPot: true,
      winnerComb: undefined,
      table: table,
    });
  }
  return result;
}
function updateTable(table, masterIndex, childIndex, playerAlias) {
  table[masterIndex]["child"][childIndex]["cellValue"] = playerAlias;
  let result = checkWin(table, masterIndex, playerAlias);

  //corresponding small game has a winner
  //     (active all none winner small games)
  if (result.table[childIndex].master.winner != undefined) {
    result.table.map((childTable) => {
      //disable completed small game cells
      childTable.master.winner != undefined
        ? (cellStatus = "disabled")
        : (cellStatus = "enabled");

      childTable["child"].map((element) => {
        element.status = cellStatus; //enable all table cells
      });
    });
  }

  //in case the corresponding small game has no winner yet (its cells can be played)
  else {
    result.table.map((childTable) => {
      childTable["child"].map((element) => {
        element.status = "disabled"; //disable all table cells
        // element.status = "enabled"; //disable all table cells
      });
      //enable the corresponding small game cells for the opponent
      result.table[childIndex]["child"].map((element) => {
        element.status = "enabled"; //enable play area for next player
      });
    });
  }

  return result;
  //return checkWin(table, masterIndex, playerAlias);
}
function playCell(room, masterIndex, childIndex, currentPlayer) {
  // keep track of the user played cells
  room.move.push({
    masterIndex: masterIndex,
    childIndex: childIndex,
    playerAlias: currentPlayer,
    time: new Date(),
  });

  //implement the action to the room
  updatedRoom = updateTable(
    room.gameTable,
    masterIndex,
    childIndex,
    currentPlayer
  );
  //update the last played cell (for front end animation)
  room.lastMove = {
    masterIndex: masterIndex,
    childIndex: childIndex,
  };
  room.gameTable = updatedRoom.table;
  room.isGameEnd = updatedRoom.isGameEnd;
  room.isPot = updatedRoom.isPot;
  room.winnerAlias = currentPlayer;

  //set the next turn player in the room
  currentPlayer == "X"
    ? (room.currentPlayer = "O")
    : (room.currentPlayer = "X");
}

function getAvailabeMoves(table) {
  let result = [];
  table.forEach((childTable, masterIndex) => {
    if (childTable.master.winner != undefined) return;
    childTable["child"].forEach((item, childIndex) => {
      if ((item.cellValue != "") | (item.status != "enabled")) return;
      result.push({ masterIndex: masterIndex, childIndex: childIndex });
    });
  });
  return result
}

function playRandom(room) {
  const delayRandom = parseInt(Math.random() * 4) + 1; //1-5 sec random play delay :D
  const availableMoves = getAvailabeMoves(room.gameTable);
  const randomMove = availableMoves[
    parseInt(Math.random() * availableMoves.length)
  ];
  setTimeout(() => {
    playCell(
      room,
      randomMove.masterIndex,
      randomMove.childIndex,
      room.currentPlayer
    );
  }, delayRandom);
}
//update all rooms in case of lost connection
setInterval(() => {
  //for each room brodcast the latest status to both players
  for (const [key, value] of Object.entries(rooms)) {
    io.to(key).emit("update", JSON.stringify(value));
  }
}, 5000);
