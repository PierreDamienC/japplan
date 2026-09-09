package com.pdcaux.japplan;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DriveFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
