FROM node:10

WORKDIR /code
# COPY . .

RUN npm install
run npm run setup
RUN cd client && npm install
RUN cd server && npm install

EXPOSE 3000
EXPOSE 3210

ENTRYPOINT ["./entrypoint.sh"]