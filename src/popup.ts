'use strict';

import './popup.css'; // ビルド時に読み込まれるのはここ
import { calendarApiResponse, calendarEvent } from './types';

(function () {
  /**
   * 現在時刻を取得してDOMの書き換えを行う
   */
  function writeTime() {
    const realTime = new Date();
    const hour = realTime.getHours();
    const minutes = realTime.getMinutes();
    const seconds = realTime.getSeconds();
    const text = hour + ':' + minutes + ':' + seconds;
    document.getElementById('real-time')!.innerHTML = text;
  }

  /**
   * OAuth認証を行う
   */
  function auth() {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const redirectUri = process.env.REDIRECT_URI;
    const scope = process.env.SCOPE;
    const accessType = 'offline';
    const responseType = 'code';

    const identityUrl =
      'https://accounts.google.com/o/oauth2/auth?' +
      `client_id=${clientId}&` +
      `redirect_uri=${redirectUri}&` +
      `scope=${scope}&` +
      `access_type=${accessType}&` +
      `response_type=${responseType}`;

    chrome.identity.launchWebAuthFlow(
      {
        url: identityUrl,
        interactive: true,
      },
      (responseUrl) => {
        if (responseUrl == undefined) throw Error('エラー');

        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');

        fetch('https://accounts.google.com/o/oauth2/token', {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code: code,
          }),
        })
          .then((response) => response.json())
          .then((json) => {
            const accessToken = json['access_token'];
            const refreshToken = json['refresh_token'];
            // ローカルにトークンを保存
            chrome.storage.local.set({
              accessToken: accessToken,
              refreshToken: refreshToken,
            });
          });
      }
    );
  }

  const apiRequest = (accessToken: string): Promise<calendarApiResponse> => {
    const params = {
      maxResults: '5',
    };

    const queryParams = new URLSearchParams(params);
    return fetch(`${process.env.CALENDAR_API_URL}?${queryParams}`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=utf-8',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw Error();
        }
        return response.json();
      })
      .catch((error) => {
        console.log(error);
      });
  };

  async function createCalendarTable() {
    const storage = await chrome.storage.local.get();
    const calendarEvents = await apiRequest(storage.accessToken);
    const items = await calendarEvents.items;

    // 予定が見つからなかった場合
    if (items.length == 0) return;

    const tableElement = document.createElement('table');
    const theadElement = document.createElement('thead');
    const tbodyElement = document.createElement('tbody');
    tableElement.appendChild(theadElement);
    tableElement.appendChild(tbodyElement);

    const row_1 = document.createElement('tr');
    const heading_1 = document.createElement('th');
    const heading_2 = document.createElement('th');
    const heading_3 = document.createElement('th');
    heading_1.innerHTML = 'タイトル';
    heading_2.innerHTML = '開始';
    heading_3.innerHTML = '終了';
    row_1.appendChild(heading_1);
    row_1.appendChild(heading_2);
    row_1.appendChild(heading_3);
    theadElement.appendChild(row_1);

    const rows = [];
    for (const [index, event] of items.entries()) {
      const row_2 = document.createElement('tr');
      const row_2_data_1 = document.createElement('td');
      const row_2_data_2 = document.createElement('td');
      const row_2_data_3 = document.createElement('td');
      row_2_data_1.innerHTML = event.summary;
      row_2_data_2.innerHTML = event.start.dateTime;
      row_2_data_3.innerHTML = event.end.dateTime;
      row_2.appendChild(row_2_data_1);
      row_2.appendChild(row_2_data_2);
      row_2.appendChild(row_2_data_3);
      tbodyElement.appendChild(row_2);
    }
    document.getElementById('table')!.appendChild(tableElement);
  }

  document.getElementById('btn')!.addEventListener('click', async () => {
    chrome.storage.local.get('accessToken', (items) => {
      document.getElementById(
        `accessToken`
      )!.innerHTML = `Bearer ${items.accessToken}`;
    });
  });

  window.onload = () => {
    auth();
    createCalendarTable();
    //1秒ごとに関数を実行
    setInterval(writeTime, 1000);
  };
})();
