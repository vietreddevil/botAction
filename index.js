const UserAgents = require('./useragents');
const puppeteer = require('puppeteer');
var amqplib = require('amqplib');
const config = require('./config');

var autoScroll = async (page) => {
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var scrollCount = 0;
            var timer = setInterval(() => {
                scrollCount++;
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight || scrollCount > 20) {
                    clearInterval(timer);
                    resolve();
                }
            }, 500);
        });
    });
}

var login = (page, username, password) => {
    return new Promise(async (resolve, reject) => {
        (async () => {
            await page.goto("https://www.facebook.com/", {
                waitUntil: 'load',
                timeout: config.timeout * 1000
            });
            await page.type('#email', username);
            await page.type('#pass', password);
            await page.click('#loginbutton');
            await page.waitForNavigation();
            resolve(1);
        })().catch((error) => {
            resolve("error");
            console.log("error detail: " + error);
        });
    });
}

var getPagemainPostNumber = async (page) => {
    var _pageInfo = await page.evaluate(async () => {
        return new Promise((resolve, reject) => {
            let postNum = document.querySelectorAll('._99s5').length;
            resolve(postNum);
        });
    });
    return _pageInfo;
}

var reportPosts = (_len, i, page) => {
    return new Promise(async (resolve, reject) => {
        if (i == _len + 1) {
        	setTimeout(function() {
            	resolve(1);
        	}, 1000 * 15)
        } else {
            (async () => { 
                /////////// 
                await page.click('._99s5:nth-child(' + i + ') ._271k._271l._1o4e._271m._1qjd._7tvm._7tv2._7tv4');
                try {
                    await page.waitForSelector("._6ff7");
                    await page.click('._6ff7:nth-child(1)');
                    await page.waitForSelector("._4t2a");
                    let randomNum = Math.floor(Math.random() * 6) + 1;
                    await page.click('.uiList._4kg._6-h._704._6-i li:nth-child(' + randomNum + ') label')
                    await page.click('._42ft._4jy0.layerConfirm._5xcs._5ipw.uiOverlayButton._4jy3._4jy1.selected._51sy');
                    // await page.waitForSelector('._42ft._4jy0.layerButton._5wvw._5ipw.uiOverlayButton._4jy3._4jy1.selected._51sy');
                    await page.waitFor(2000);
                    await page.click('._42ft._4jy0.layerButton._5wvw._5ipw.uiOverlayButton._4jy3._4jy1.selected._51sy');
                }catch(e) {
                    console.log(e);
                }
                await page.waitFor(5000);
                console.log('post ' + i);
                i++;
                await reportPosts(_len, i, page);
                resolve(1);
            })().catch(async (error) => {
                resolve("TIMEOUT");
                console.log(error);
            });
        }
    })
}

var startBot = async (botNumber, username, password) => {
    var connection;
    var publish_channel;
    var consume_channel;
    var browser;
    var page;
    try {
        browser = await puppeteer.launch({
            headless: false, args: [
                '--no-sandbox',
            ],
        });
        page = await browser.newPage();
    } catch (e) {
        console.log(e);
    }

    await login(page, username, password);

    try {
        connection = await amqplib.connect('amqp://' + encodeURIComponent(config.rabbit_user) + ':' + encodeURIComponent(config.rabbit_password) + '@' + config.rabbit_server + "/" + config.rabbit_vhost);
        console.log('start the bot . . .' + botNumber)
    } catch (e) {
        console.log(e);
    }
    try {
        consume_channel = await connection.createChannel();
        await consume_channel.assertQueue(config.input_queue);
        await consume_channel.prefetch(1);
        consume_channel.consume(config.input_queue, async (msg) => {
            if (msg != null) {
                var message = (msg.content.toString());
                let pageID = JSON.parse(message).id;
                let url = "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&impression_search_field=has_impressions_lifetime&view_all_page_id="
                    + pageID + "&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped";
                await page.goto(url, {
                    waitUntil: 'load',
                    timeout: config.timeout * 1000
                });
                let pageMainPostNumber = await getPagemainPostNumber(page);
                console.log('report ' + pageMainPostNumber + ' posts');
                reportPosts(pageMainPostNumber, 1, page).then(rs => {
                    console.log(pageID);
                    consume_channel.ack(msg);
                });
            }
        }, {
            noAck: false
        });
    } catch (e) {
        console.log(e);
    }
}


var start = () => {
    //dung nick clone thoi, khong co bao mat cap 2 cang tot
    startBot(1, 'account1', 'pwd1');
    startBot(2, 'account2', 'pwd2');
}

start();