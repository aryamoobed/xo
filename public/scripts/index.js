const socket = io();
const xoTable = $(".child-cell");
let linkRoomId = location.pathname.split("/")[2];
let roomId = getCookie("roomId");
let newRoomId = "";
let playerAlias = getCookie("playerAlias");
let playerId = getCookie("playerId");
let playerName = getCookie("playerName");
let currentPlayerAlias = "";
let tempHelpConfig = [];
let frame = [];
let snap = [];
let currentAlias = "x";
let curentDisplayedHelp = 0;
let globalIntervals = [];
const loading = $("#loading-container");
let data = {
  cookie: {
    roomId: roomId,
    playerId: playerId,
    playerName: playerName,
    playerAlias: playerAlias,
  },
  linkRoomId: linkRoomId,
};

showLoading();
$(document).ready(function () {
  setTimeout(() => {
    loading.addClass("hide");
    $("#main-container")[0].classList.remove("hide");
    if ($("#modal").hasClass("hide")) $("#game-container").removeClass("hide");
  }, 3000);
});

postJSON(data).then((data) => {
  //console.log(data);
  $("#modal-msg").text(data.msg);

  if (data.isSwitchGame) {
    $("#confirm-dialog").removeClass("hide");
    $("#register-input").addClass("hide");
    newRoomId = data.joinRoomId;
    return;
  }

  if (data.isNewGame) {
    clearCookie();
    roomId = data.joinRoomId;
  } else {
    $("#gameLink").text(location.origin + "/xo/" + roomId);
    $("#modal").addClass("hide");
    $("#game-container").removeClass("hide");

    socket.emit(
      "client-update",
      JSON.stringify({
        roomId: roomId,
        playerId: playerId,
        playerName: playerName,
      })
    );
  }
});

socket.on("player-update", (packet) => {
  const player = JSON.parse(packet);
  if (!roomId) roomId = player.roomId;
  playerId = player.id;
  playerAlias = player.alias;
  saveCookie();
  $("#gameLink").text(location.origin + "/xo/" + roomId);
});
socket.on("update", (packet) => {
  const data = JSON.parse(packet);
  currentPlayerAlias = data.currentPlayer;
  const player1 = $("#player1Name");
  const player2 = $("#player2Name");
  // const player1container = $("#player1Name .player1container");
  // const player2container = $("#player2Name .player2container");
  const player1container = $(".player1container");
  const player2container = $(".player2container");
  if (data.player2.name == "") {
    player2.text("waiting ...");
  } else {
    player2.text(data.player2.name);
  }
  player1.text(data.player1.name);

  if (data.currentPlayer == "X") {
    player1container[0].classList.add("player-selected");
    player2container[0].classList.remove("player-selected");
  } else {
    player1container[0].classList.remove("player-selected");
    player2container[0].classList.add("player-selected");
  }

  data.gameTable.forEach((item, i) => {
    let mainCell = $(".main-cell");
    mainCell[i].classList.remove("playfield");
    if (item.master.winner != undefined && !item.master.winner.isPot) {
      let alias = item.master.winner.winnerAlias;

      // mainCell[i].innerText= item.master.winner.winnerAlias;
      $(`.main-cell:nth-child(${i + 1}) .child-cell`).addClass("hide");
      $(".main-cell span")[i].innerHTML = item.master.winner.winnerAlias;
      $(".main-cell span")[i].classList.remove("hide");

      mainCell[i].classList.add("main-win");
      if (alias != "")
        alias == "X"
          ? mainCell[i].classList.add("alias-x")
          : mainCell[i].classList.add("alias-o");
    }
    item["child"].forEach((element, j) => {
      let alias = element.cellValue;
      let childCell = xoTable[i * 9 + j];
      childCell.innerHTML = element.cellValue;
      childCell.classList.remove("waviy");

      if (element.status == "enabled") {
        childCell.classList.add("enabled");
        childCell.classList.remove("disabled");
      } else {
        childCell.classList.remove("enabled");
        childCell.classList.add("disabled");
      }
      if (alias != "")
        alias == "X"
          ? childCell.classList.add("alias-x")
          : childCell.classList.add("alias-o");
    });
  });
  if (data.lastMove != undefined && !data.isGameEnd)
    xoTable[
      data.lastMove.masterIndex * 9 + data.lastMove.childIndex
    ].classList.add("waviy");

  if (data.isGameEnd) {
    let winnerName = "";
    let looserName = "";
    if (data.winnerAlias == data.player1.alias) {
      winnerName = data.player1.name;
      looserName = data.player2.name;
    } else {
      winnerName = data.player2.name;
      looserName = data.player1.name;
    }

    if (data.isPot) {
      $("#banner").text("No one wins :)");
    } else {
      // $("#banner").text(`${winnerName} WINS! \n ${looserName} LO...Oses!`);
      $("#winner-name").text(winnerName);
      $("#looser-name").text(looserName);
      if (winnerName == playerName) document.getElementById("win-sound").play();
      else document.getElementById("loose-sound").play();
    }
    // else {
    //   $("#banner").text("lO...Oser !!");
    // }

    $("#result").removeClass("hide");
    $("#game-container").addClass("hide");
    player1container[0].classList.remove("player-selected");
    player2container[0].classList.remove("player-selected");
    xoTable[
      data.lastMove.masterIndex * 9 + data.lastMove.childIndex
    ].classList.remove("waviy");
    return;
  }
  if (data.currentPlayer == playerAlias)
    document.getElementById("ding-sound").play();
});
socket.on("room-closed", (packet) => {
  clearCookie();
  window.location.href = location.href; //relative to domain
});
socket.on("rematch", () => {
  redrawTable();
  $("#result").addClass("hide");
  $("#game-container").removeClass("hide");
});
// $(".child-cell").hover(
//   function () {
//     const cellIndex = $(this).index(); //$(this).attr("cell");
//     const mainCell = $(".main-cell");
//     if ($(this).hasClass("disabled")) return;
//     mainCell[cellIndex].classList.add("playfield");
//   },
//   function () {
//     const cellIndex = $(this).index();
//     const mainCell = $(".main-cell");
//     mainCell[cellIndex].classList.remove("playfield");
//   }
// );

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////<<actions>>/////////////////////////////////////

$(document).on("click", "#accept-btn", function (event) {
  // console.log(event);
  clearCookie(); //delte previous game info from cookie
  $("#confirm-dialog").addClass("hide");
  $("#register-input").removeClass("hide");
  location.reload();
});
$(document).on("click", "#decline-btn", function (event) {
  location.assign("/xo");
});
$(document).on("click", "#play-btn", function () {
  playerName = $("#playerName").val();
  if (!playerName) return;
  $("#modal").addClass("hide");
  $("#game-container").removeClass("hide");
  // $("#main").removeClass("hide");
  socket.emit(
    "join-room",
    JSON.stringify({
      roomId: roomId,
      playerName: playerName,
      playerId: playerId,
    })
  );
});
$(document).on("click", "#gameLink", function () {
  let copyText = $(this);
  let inputValue = $(this).attr("value");
  let textArea = document.createElement("textarea");
  textArea.value = copyText[0].textContent;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("Copy");
  textArea.remove();
  $(this).attr("value", "link copied");
  setTimeout(() => {
    $(this).attr("value", inputValue);
  }, 2000);
});
$(document).on("click", "#game-container .child-cell", function () {
  if (
    !playerAlias ||
    !roomId ||
    !currentPlayerAlias | ($(this).text() != "") ||
    currentPlayerAlias != playerAlias ||
    $(this).hasClass("disabled")
  )
    return;
  const cellIndex = $(this).index() - 1; //.attr("cell");
  const parentCellIndex = $(this).parent().index();

  socket.emit(
    "moveUpdate",
    JSON.stringify({
      roomId: roomId,
      masterIndex: parentCellIndex,
      childIndex: cellIndex,
      playerAlias: playerAlias,
    })
  );
  document.getElementById("tic-sound").play();
});
$(document).on("click", "#help-container .child-cell", function () {
  const cellIndex = $(this).index(); //NOTE: as its not the first element in parent element it starts from 1
  const parentCellIndex = $(this).parent().index() + 1; //NOTE: to treat the index same as above +1 is added
  const mainCell = $("#help-container .main-cell");
  // console.log(parentCellIndex, cellIndex);

  if ($(this).hasClass("disabled")) return;
  // $(`#help-container .main-cell:not(:nth-child(${cellIndex+1})) .child-cell`).addClass("disabled")
  // $(`#help-container .main-cell:nth-child(${cellIndex+1}) .child-cell`).removeClass("disabled")
  // $(this)[0].classList.add("alias-x");
  // $(this)[0].innerHTML="X"

  playFrame("help-container", currentAlias, parentCellIndex, cellIndex);
  frame.push({
    parentCellIndex: parentCellIndex,
    cellIndex: cellIndex,
    currentAlias: currentAlias,
  });
  // console.log(frame);
  currentAlias == "o" ? (currentAlias = "x") : (currentAlias = "o");
});
$(document).on("click", "#replay-btn", function () {
  // document.location.reload();
  socket.emit(
    "rematch",
    JSON.stringify({
      roomId: roomId,
      playerId: playerId,
      playerName: playerName,
      playerAlias: playerAlias,
    })
  );
});
$(document).on("click", "#exit-btn", function () {
  clearCookie();
  socket.emit("exit-room", roomId);
  document.location.reload();
});
//click on next help button
$(document).on("click", "#help-next-btn", function () {
  //if it,s the last page do nothing
  if (curentDisplayedHelp == helpConfig.length - 1) return;
  //increse page index
  curentDisplayedHelp++;
  //show the instruction scene and description
  showScene("help-container", helpConfig, curentDisplayedHelp);
  //update the help instruction page index displayed
  updatePageIndex(
    $("#help-index-spn"),
    curentDisplayedHelp + 1,
    helpConfig.length
  );
});
//click on previous help button
$(document).on("click", "#help-prev-btn", function () {
  //if it,s the first page do nothing
  if (curentDisplayedHelp == 0) return;
  //decrease the page index
  curentDisplayedHelp--;
  //update the help instruction page index displayed
  updatePageIndex(
    $("#help-index-spn"),
    curentDisplayedHelp + 1,
    helpConfig.length
  );
  //show the instruction scene and description
  showScene("help-container", helpConfig, curentDisplayedHelp);
});
//click on help span
$(document).on("click", ".far.fa-question-circle", function () {
  //show help modal
  $("#help-modal").removeClass("hide");
  //show the help animation first page->(1)
  showScene("help-container", helpConfig, curentDisplayedHelp);
  updatePageIndex(
    $("#help-index-spn"),
    curentDisplayedHelp + 1,
    helpConfig.length
  );
});
//click on help modal close button
$(document).on("click", "#help-close-btn", function () {
  //close the help modal
  $("#help-modal").addClass("hide");
});
//hold on a smaller game grid winner
$(document).on("pointerdown", ".main-win", function () {
  //show the smaller game grid combinition beneath the big winner
  $(this).addClass("trans");
});
//release the hold on a smaller game grid winner
$(document).on("pointerup", ".main-win", function () {
  //hide the smaller game grid combination
  $(this).removeClass("trans");
});
$("#finger-pointer-spn").on("transitionend",(event)=>{
  console.log(event.originalEvent.propertyName+"transitioned")
 })
////////////////////////////////////////////////////////////////////////////////
///////////////////////////////<<functions>>////////////////////////////////////
function updatePageIndex(element, pageIndex, totalPages) {
  element.text(pageIndex + " / " + totalPages);
}
function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}
function setCookie(cname, cvalue, exdays) {
  const d = new Date();
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
  let expires = "expires=" + d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}
function clearCookie() {
  document.cookie = "roomId=;  expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "playerId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie =
    "playerAlias=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie =
    "playerName=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}
function saveCookie() {
  setCookie("roomId", roomId, 1);
  setCookie("playerId", playerId, 1);
  setCookie("playerName", playerName, 1);
  setCookie("playerAlias", playerAlias, 1);
}
async function postJSON(data) {
  try {
    const response = await fetch("/xo", {
      method: "POST", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return error;
  }
}
function showLoading() {
  let i = 0;
  let loadingCells = $(".loading-cell");
  let interval = setInterval(() => {
    loadingCells[i].classList.add("pop");
    if (i++ == 8) return clearInterval(interval);
  }, 180);
}
function redrawTable() {
  $(".main-cell").attr("class", "main-cell");
  $(".child-cell").attr("class", "child-cell");
  $(".main-cell span").text("");
  $(".main-cell span").addClass("hide");
  $(".child-cell").text("");
}
function checkWin(aliasPattern) {
  const winCombinations = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9],
    [1, 5, 9],
    [3, 5, 7],
  ];
  let isGridWin = false;
  winCombinations.forEach((combination) => {
    if (isGridWin) return;
    let matchedCombination = 0;
    combination.forEach((item) => {
      if (aliasPattern.indexOf(item) != -1) matchedCombination++;
      if (matchedCombination == 3) isGridWin = true;
    });
  });
  return isGridWin;
}
function playRandom(tableId) {
  const possibleMove = $(
    `#${tableId} .child-cell:not('.disabled'):not('.hide'):empty`
  );
  if (possibleMove.length == 0) return;
  const randomMove = Math.floor(Math.random() * possibleMove.length);
  // console.log(randomMove);
  possibleMove[randomMove].click();
}
function playFrame(tableId, alias, parentCellIndex, cellIndex) {
  //if the cell has been played before return "invalid move"
  if (
    $(
      `#${tableId} .main-cell:nth-child(${parentCellIndex}) .child-cell:nth-child(${
        cellIndex + 1
      })`
    ).text() != ""
  )
    return console.log("invalid move!");

  //animate move the finger pointere to the destination cell
  $("#finger-pointer-spn").offset(
    $(
      `#${tableId} .main-cell:eq(${parentCellIndex - 1}) .child-cell:eq(${
        cellIndex - 1
      })`
    ).offset()
  );
//  $("#finger-pointer-spn").on("transitionend webkitTransitionEnd",()=>{
//   console.log("transitioned")
//  })
  $(".waviy").removeClass("waviy");

  const playedCell = $(
    `#${tableId} .main-cell:nth-child(${parentCellIndex}) .child-cell:nth-child(${
      cellIndex + 1
    })`
  )[0];
  playedCell.innerHTML = alias;
  playedCell.classList.add(`alias-${alias}`);
  playedCell.classList.add(`waviy`);
  let aliasPattern = [];

  $(
    `#${tableId} .main-cell:nth-child(${parentCellIndex}) .child-cell:contains('${alias}')`
  ).each(function (index) {
    aliasPattern.push($(this).index());
  });

  //check if a grid has a winner
  let isGridWin = checkWin(aliasPattern);
  if (isGridWin) {
    $(".waviy").removeClass("waviy");

    const parentCell = $(
      `#${tableId} .main-cell:nth-child(${parentCellIndex})`
    );
    parentCell.children("span").text(alias);
    parentCell.children("span").removeClass("hide");
    parentCell.children("span").addClass(`alias-${alias}`);
    parentCell.children("span").addClass("main-win");
    parentCell.children("span").on("animationend", (event) => {
      parentCell.children(".child-cell").addClass("disabled");
    });

    //console.log("win", parentCellIndex, alias);
  }
  //check if the coresponding parentcell has a winner
  if (
    $(`#${tableId} .main-cell:nth-child(${cellIndex}) span`).hasClass(
      "main-win"
    )
  ) {
    // $(`#${tableId}  .child-cell`).removeClass("disabled"); //make all cells available to play
    $(`#${tableId}  .main-cell span:not(.main-win) `)
      .siblings(".child-cell")
      .removeClass("disabled"); //make all cells except main winner ones available to play
  } else {
    $(
      `#${tableId} .main-cell:not(:nth-child(${cellIndex})) .child-cell`
    ).addClass("disabled");
    $(`#${tableId} .main-cell:nth-child(${cellIndex}) .child-cell`).removeClass(
      "disabled"
    ); //make only corresponding cells available to play
  }
  //check if game has a winner
  if (!isGridWin) return; //if grid has no winner check is unneccesary
  if ($(`#${tableId} .main-win:contains("${alias}")`).length < 3) return; //if less than 3 winner parent check in unneccesary
  aliasPattern = [];
  $(`#${tableId} .main-win:contains("${alias}")`).each(function (index) {
    aliasPattern.push($(this).parent().index() + 1); //check for parent grid patter for a game winner
  });
  //if (checkWin(aliasPattern)) console.log(`${alias} wins the game`);
}
function showScene(tableId, helpConfig, index) {
  //clear the previous show frames
  if (globalIntervals.length > 0) {
    clearInterval(globalIntervals[0]);
    globalIntervals.splice(0, 1);
  }
  //show help descriotion
  $(`#${tableId} #description-span`).text(helpConfig[index].description);
  //initialize the game for help demo
  showSnap(tableId, helpConfig, index);
  //demo the actions
  let frameIndex = 0;
  if (helpConfig[index].frame.length > 0)
    globalIntervals.push(
      setInterval(
        () => {
          if (frameIndex == helpConfig[index].frame.length) {
            showSnap(tableId, helpConfig, index);
            return (frameIndex = 0);
          }
          playFrame(
            "help-container",
            helpConfig[index].frame[frameIndex].currentAlias,
            helpConfig[index].frame[frameIndex].parentCellIndex,
            helpConfig[index].frame[frameIndex].cellIndex
          );
          frameIndex++;
          // if (helpConfig[index].frame[frameIndex] === undefined) frameIndex = 0;
        },

        2000
      )
    );
}
function showSnap(tableId, helpConfig, index) {
  $(`#${tableId} .main-cell`)
    .children()
    .each(function (itemIndex) {
      $(this).text(helpConfig[index].snap[itemIndex].text);
      $(this).removeClass();
      $(this).addClass(helpConfig[index].snap[itemIndex].class);
    });
}

setInterval(() => {
  //playRandom("help-container")
}, 100);
