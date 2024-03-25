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

let rooms = {};
let playersRoomId = {};
const port = process.env.PORT || 80;

app.get("/", function (req, res) {
  return res.redirect("/xo")
})
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
    JSON.stringify({ isNewGame: true, msg: "Creating a new game" })
  );
});


server.listen(port, function () { });

io.on("connection", (socket) => {
  socket.on("client-update", (packet) => {
    data = JSON.parse(packet);
    socket.join(data.roomId);
    io.to(data.roomId).emit("update", JSON.stringify(rooms[data.roomId]));
  });
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
        round:[]
      };
      // console.log(rooms)
      socket.join(roomId);
      playersRoomId[playerId] = roomId;
      let result = rooms[roomId].player1;
      result.roomId = roomId;
      socket.emit("player-update", JSON.stringify(result)); // create and send new room link
    } else {
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
    //console.log(rooms)
    //console.log(playersRoomId)

    io.to(roomId).emit("update", JSON.stringify(rooms[roomId]));
  });
  socket.on("moveUpdate", (packet) => {
    const data = JSON.parse(packet);
    const currentPlayer = rooms[data.roomId].currentPlayer;
    const gameTable = rooms[data.roomId].gameTable;
    const masterIndex = data.masterIndex;
    const childIndex = data.childIndex;
    if (
      data.playerAlias != currentPlayer ||
      gameTable[masterIndex]["child"][childIndex]["cellValue"].status ==
      "disabled"
    )
      return;
    rooms[data.roomId].move.push({
      masterIndex: masterIndex,
      childIndex: childIndex,
      playerAlias: currentPlayer,
      time: new Date(),
    });
    updatedRoom = updateTable(
      gameTable,
      masterIndex,
      childIndex,
      currentPlayer
    );
    rooms[data.roomId].lastMove = {
      masterIndex: masterIndex,
      childIndex: childIndex,
    };
    rooms[data.roomId].gameTable = updatedRoom.table;
    rooms[data.roomId].isGameEnd = updatedRoom.isGameEnd;
    rooms[data.roomId].isPot = updatedRoom.isPot;
    rooms[data.roomId].winnerAlias = currentPlayer;

    currentPlayer == "X"
      ? (rooms[data.roomId].currentPlayer = "O")
      : (rooms[data.roomId].currentPlayer = "X");
    //console.log(checkWin(rooms[data.roomId].gameTable, data.masterIndex - 1, data.playerAlias));
    io.to(data.roomId).emit("update", JSON.stringify(rooms[data.roomId]));

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
    delete rooms[data.roomId].lastMove
    rooms[data.roomId].isGameEnd = false;
    rooms[data.roomId].round.push(rooms[data.roomId].winnerAlias)
    rooms[data.roomId].isPot = false;
    rooms[data.roomId].winnerAlias = "";
    rooms[data.roomId].move = []
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

  ////disable the coresponding cells for next player
  if (result.table[childIndex].master.winner != undefined) {
    result.table.map((childTable) => {
      childTable["child"].map((element) => {
        element.status = "enabled"; //disable all table cells
      });
    });
  } else {
    result.table.map((childTable) => {
      childTable["child"].map((element) => {
        element.status = "disabled"; //disable all table cells
        // element.status = "enabled"; //disable all table cells
      });
    });
    result.table[childIndex]["child"].map((element) => {
      element.status = "enabled"; //enable play area for next player
    });
  }

  return result;
  //return checkWin(table, masterIndex, playerAlias);
}

setInterval(() => {
  if (!rooms) return
  for (const [key, value] of Object.entries(rooms)) {
    io.to(key).emit("update", JSON.stringify(value));
  }
}, 5000);
