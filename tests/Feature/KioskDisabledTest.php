<?php

it('keeps the public kiosk closed', function () {
    $this->get('/kiosk/tickets/create')->assertNotFound();
    $this->post('/kiosk/tickets', ['title' => 'Test'])->assertNotFound();
});
